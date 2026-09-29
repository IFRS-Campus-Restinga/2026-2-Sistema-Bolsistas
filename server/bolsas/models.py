from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords

from editais.models import Edital
from projetos.models import Projeto


class Modalidade(models.TextChoices):
    BICT = "BICT", "Bolsa de Iniciação Científica"
    BIDTI = "BIDTI", "Bolsa de Iniciação ao Desenvolvimento Tecnológico e Inovação"
    BAT = "BAT", "Bolsa de Apoio Técnico"


class TipoBolsa(models.TextChoices):
    ENSINO = "ENSINO", "Ensino"
    PESQUISA = "PESQUISA", "Pesquisa"
    EXTENSAO = "EXTENSAO", "Extensão"
    INDISSOCIAVEL = "INDISSOCIAVEL", "Indissociável"


class StatusBolsa(models.TextChoices):
    SOLICITADA = "SOLICITADA", "Solicitada"
    APROVADA = "APROVADA", "Aprovada"
    REJEITADA = "REJEITADA", "Rejeitada"
    ABERTA = "ABERTA", "Aberta"
    EM_SELECAO = "EM_SELECAO", "Em Seleção"
    PREENCHIDA = "PREENCHIDA", "Preenchida"
    ENCERRADA = "ENCERRADA", "Encerrada"
    CANCELADA = "CANCELADA", "Cancelada"


STATUS_EDITAVEIS = [StatusBolsa.SOLICITADA, StatusBolsa.APROVADA, StatusBolsa.ABERTA]


PESO_TOTAL = Decimal("100")


def caminho_arquivo_bolsa(instance, filename):
    return f"bolsas/{instance.pk}/{filename}"


class Bolsa(models.Model):
    projeto = models.ForeignKey(Projeto, on_delete=models.CASCADE, related_name="bolsas")
    edital = models.ForeignKey(Edital, on_delete=models.PROTECT, related_name="bolsas")
    tipo = models.CharField(
        max_length=20,
        choices=TipoBolsa.choices,
        help_text="Define qual Coordenador de Área aprova/rejeita esta bolsa.",
    )
    modalidade = models.CharField(max_length=10, choices=Modalidade.choices)
    carga_horaria_semanal = models.PositiveIntegerField()
    valor_mensal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Placeholder — no futuro será calculado a partir de modalidade + carga horária.",
    )
    quantidade_vagas = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Quantidade de vagas (titulares) ofertadas nesta bolsa.",
    )
    prerequisitos = models.TextField(blank=True, default="")
    metodologia_avaliacao = models.TextField(blank=True, default="")
    nota_minima = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
    )
    data_inicio_vigencia = models.DateField(null=True, blank=True)
    data_fim_vigencia = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=15,
        choices=StatusBolsa.choices,
        default=StatusBolsa.SOLICITADA,
    )
    data_solicitacao = models.DateTimeField(auto_now_add=True)
    data_decisao = models.DateTimeField(null=True, blank=True)
    justificativa_decisao = models.TextField(blank=True, default="")
    coordenador_area = models.ForeignKey(
        "accounts.CoordenadorArea",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="bolsas_avaliadas",
        help_text="Coordenador de Área que aprovou/rejeitou esta bolsa.",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["-data_solicitacao"]

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.carga_horaria_semanal}h ({self.get_status_display()})"

    def clean(self):
        if self.status == StatusBolsa.PREENCHIDA and self.edital.data_maxima_preenchimento_vagas:
            if date.today() > self.edital.data_maxima_preenchimento_vagas:
                raise ValidationError(
                    f"Não é possível preencher bolsa após {self.edital.data_maxima_preenchimento_vagas.strftime('%d/%m/%Y')}. "
                    "Prorogue a data no cronograma do edital."
                )

    def motivo_bloqueio_edicao(self):
        if self.status not in STATUS_EDITAVEIS:
            return f'Uma bolsa "{self.get_status_display()}" não pode mais ser editada.'

        fechamento = self.edital.data_fechamento_inscricoes
        if fechamento and timezone.localdate() > fechamento:
            return (
                "O prazo de inscrições do edital terminou em "
                f"{fechamento:%d/%m/%Y}; a bolsa não pode mais ser editada."
            )
        return ""

    def motivo_bloqueio_etapas(self):
        if self.status == StatusBolsa.SOLICITADA:
            return (
                "As etapas de avaliação só podem ser cadastradas depois que a bolsa for aprovada."
            )
        return self.motivo_bloqueio_edicao()

    def pesos_efetivos_etapas(self):
        etapas = list(self.etapas.all())
        indefinidas = [etapa for etapa in etapas if etapa.peso is None]
        soma_definidos = sum((e.peso for e in etapas if e.peso is not None), Decimal("0"))
        cota = None
        if indefinidas:
            resto = max(PESO_TOTAL - soma_definidos, Decimal("0"))
            cota = (resto / len(indefinidas)).quantize(Decimal("0.01"), ROUND_HALF_UP)
        return {etapa.id: etapa.peso if etapa.peso is not None else cota for etapa in etapas}

    def aviso_pesos_etapas(self):
        etapas = list(self.etapas.all())
        if not etapas:
            return ""
        indefinidas = sum(1 for etapa in etapas if etapa.peso is None)
        soma = sum((e.peso for e in etapas if e.peso is not None), Decimal("0"))
        if indefinidas and soma >= PESO_TOTAL:
            return (
                f"Os pesos definidos já somam {soma}%; as etapas sem peso ficariam com 0%. "
                "Ajuste os pesos ou remova essas etapas."
            )
        if not indefinidas and soma != PESO_TOTAL:
            return f"A soma dos pesos é {soma}%, mas precisa fechar 100%."
        return ""


class EtapaAvaliacao(models.Model):
    bolsa = models.ForeignKey(Bolsa, on_delete=models.CASCADE, related_name="etapas")
    nome = models.CharField(max_length=100)
    peso = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.01")), MaxValueValidator(PESO_TOTAL)],
        help_text="Peso da etapa em %. Vazio = divide igualmente o que sobra de 100%.",
    )
    data_hora = models.DateTimeField(
        null=True, blank=True, help_text="Data e hora em que a etapa acontece."
    )
    local = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Local (ex.: Sala 204) ou link da reunião online.",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["id"]
        verbose_name = "etapa de avaliação"
        verbose_name_plural = "etapas de avaliação"

    def __str__(self):
        return f"{self.nome} ({self.peso if self.peso is not None else 'peso igual'})"


# ──────────────────────────────────────────────────────────────────────────────
# US15 — Vínculo do bolsista e frequência mensal
# ──────────────────────────────────────────────────────────────────────────────


class StatusVinculo(models.TextChoices):
    ATIVO = "ATIVO", "Ativo"
    DESLIGADO = "DESLIGADO", "Desligado"


class VinculoBolsista(models.Model):
    """
    Representa o vínculo entre um aluno titular e uma bolsa preenchida.
    Nasce quando a Bolsa transiciona para PREENCHIDA (fluxo 4.5 — ainda não
    implementado). Um vínculo ATIVO por bolsa de cada vez (RN-09).
    """

    bolsa = models.ForeignKey(Bolsa, on_delete=models.PROTECT, related_name="vinculos")
    aluno = models.ForeignKey(
        "accounts.Usuario",
        on_delete=models.PROTECT,
        related_name="vinculos_bolsista",
        limit_choices_to={"role": "ALUNO"},
    )
    status = models.CharField(
        max_length=10,
        choices=StatusVinculo.choices,
        default=StatusVinculo.ATIVO,
    )
    data_inicio = models.DateField()
    data_fim = models.DateField(null=True, blank=True)

    history = HistoricalRecords()

    class Meta:
        ordering = ["-data_inicio"]
        verbose_name = "vínculo de bolsista"
        verbose_name_plural = "vínculos de bolsistas"

    def __str__(self):
        return f"{self.aluno} → {self.bolsa} ({self.get_status_display()})"

    def clean(self):
        # RN-09: apenas 1 vínculo ATIVO por bolsa
        conflito = VinculoBolsista.objects.filter(
            bolsa=self.bolsa,
            status=StatusVinculo.ATIVO,
        ).exclude(pk=self.pk)
        if conflito.exists() and self.status == StatusVinculo.ATIVO:
            raise ValidationError(
                "Já existe um vínculo ativo para esta bolsa. "
                "Desative o vínculo atual antes de criar um novo."
            )


class StatusFrequencia(models.TextChoices):
    PENDENTE = "PENDENTE", "Pendente"
    INFORMADA = "INFORMADA", "Informada"
    NAO_INFORMADA = "NAO_INFORMADA", "Não Informado"


class Frequencia(models.Model):
    """
    Frequência mensal de um bolsista vinculado.
    Lançada pelo Coordenador de Projeto até o dia_limite_frequencia do edital.
    Gerada automaticamente como NAO_INFORMADA após o prazo (command gerar_status_frequencia).
    """

    vinculo = models.ForeignKey(
        VinculoBolsista,
        on_delete=models.PROTECT,
        related_name="frequencias",
    )
    # Sempre dia 1 do mês de referência
    mes_referencia = models.DateField(
        help_text="Primeiro dia do mês de referência (ex.: 2026-09-01 para setembro/2026)."
    )
    status = models.CharField(
        max_length=15,
        choices=StatusFrequencia.choices,
        default=StatusFrequencia.PENDENTE,
    )
    lancada_em = models.DateTimeField(null=True, blank=True)
    lancada_por = models.ForeignKey(
        "accounts.Usuario",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="frequencias_lancadas",
    )

    history = HistoricalRecords()

    class Meta:
        ordering = ["-mes_referencia"]
        unique_together = [("vinculo", "mes_referencia")]
        verbose_name = "frequência mensal"
        verbose_name_plural = "frequências mensais"

    def __str__(self):
        return f"{self.vinculo.aluno} — {self.mes_referencia:%m/%Y} ({self.get_status_display()})"
