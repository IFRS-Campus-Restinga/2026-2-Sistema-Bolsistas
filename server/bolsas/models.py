from decimal import ROUND_HALF_UP, Decimal

from django.core.validators import FileExtensionValidator, MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone

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


# Status em que o Coordenador de Projeto ainda pode editar a bolsa
# (desde que o prazo de inscrições do edital não tenha terminado).
STATUS_EDITAVEIS = [StatusBolsa.SOLICITADA, StatusBolsa.APROVADA, StatusBolsa.ABERTA]

EXTENSOES_ARQUIVO_BOLSA = ["pdf", "doc", "docx"]

# Soma que os pesos das etapas de avaliação de uma bolsa precisam fechar (em %).
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
    arquivo_ementa = models.FileField(
        upload_to=caminho_arquivo_bolsa,
        blank=True,
        default="",
        validators=[FileExtensionValidator(EXTENSOES_ARQUIVO_BOLSA)],
        help_text="Matriz curricular / ementa da bolsa.",
    )
    nome_original_arquivo = models.CharField(max_length=255, blank=True, default="")
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

    class Meta:
        ordering = ["-data_solicitacao"]

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.carga_horaria_semanal}h ({self.get_status_display()})"

    def motivo_bloqueio_edicao(self):
        """Retorna o motivo pelo qual a bolsa NÃO pode ser editada, ou "" se pode.

        Regra: a bolsa pode ser editada enquanto estiver Solicitada/Aprovada/Aberta
        e o prazo de inscrições do edital não tiver terminado (até o dia do
        fechamento, inclusive). Se o edital ainda não tem data de fechamento,
        a edição fica liberada.
        """
        if self.status not in STATUS_EDITAVEIS:
            return f'Uma bolsa "{self.get_status_display()}" não pode mais ser editada.'

        fechamento = self.edital.data_fechamento_inscricoes
        if fechamento and timezone.localdate() > fechamento:
            return (
                "O prazo de inscrições do edital terminou em "
                f"{fechamento:%d/%m/%Y}; a bolsa não pode mais ser editada."
            )
        return ""

    def pesos_efetivos_etapas(self):
        """{id da etapa: peso efetivo em %}. Etapas sem peso dividem igualmente o
        que sobra de 100% — então, se nenhuma etapa tem peso, todas ficam com o
        mesmo peso (100 / n)."""
        etapas = list(self.etapas.all())
        indefinidas = [etapa for etapa in etapas if etapa.peso is None]
        soma_definidos = sum((e.peso for e in etapas if e.peso is not None), Decimal("0"))
        cota = None
        if indefinidas:
            resto = max(PESO_TOTAL - soma_definidos, Decimal("0"))
            cota = (resto / len(indefinidas)).quantize(Decimal("0.01"), ROUND_HALF_UP)
        return {etapa.id: etapa.peso if etapa.peso is not None else cota for etapa in etapas}

    def aviso_pesos_etapas(self):
        """Mensagem explicando por que os pesos não fecham 100%, ou "" se está tudo certo."""
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

    class Meta:
        ordering = ["id"]
        verbose_name = "etapa de avaliação"
        verbose_name_plural = "etapas de avaliação"

    def __str__(self):
        return f"{self.nome} ({self.peso if self.peso is not None else 'peso igual'})"


@receiver(pre_delete, sender=Bolsa)
def _remover_arquivo_ementa_do_disco(sender, instance, **kwargs):
    if instance.arquivo_ementa:
        instance.arquivo_ementa.delete(save=False)
