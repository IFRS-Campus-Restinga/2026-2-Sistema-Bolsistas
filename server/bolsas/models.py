from django.db import models

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

    class Meta:
        ordering = ["-data_solicitacao"]

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.carga_horaria_semanal}h ({self.get_status_display()})"
