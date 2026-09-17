from django.conf import settings
from django.db import models

from editais.models import Edital


class Modalidade(models.TextChoices):
    BICT = "BICT", "Bolsa de Iniciação Científica"
    BIDTI = "BIDTI", "Bolsa de Iniciação ao Desenvolvimento Tecnológico e Inovação"
    BAT = "BAT", "Bolsa de Apoio Técnico"


class StatusBolsa(models.TextChoices):
    SOLICITADA = "SOLICITADA", "Solicitada"
    DEFERIDA = "DEFERIDA", "Deferida"
    INDEFERIDA = "INDEFERIDA", "Indeferida"
    CANCELADA = "CANCELADA", "Cancelada"


class Bolsa(models.Model):

    edital = models.ForeignKey(
        Edital,
        on_delete=models.PROTECT,
        related_name="bolsas",
    )
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="bolsas_solicitadas",
        help_text="Coordenador de Projeto que solicitou a bolsa",
    )
    modalidade = models.CharField(max_length=10, choices=Modalidade.choices)
    carga_horaria_semanal = models.PositiveIntegerField()
    valor_mensal = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        help_text="Placeholder — será preenchido pela tabela do edital futuramente",
    )
    prerequisitos = models.TextField(blank=True, default="")
    nota_minima = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        null=True,
        blank=True,
    )
    data_avaliacao = models.DateField(null=True, blank=True)
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

    class Meta:
        ordering = ["-data_solicitacao"]

    def __str__(self):
        return f"{self.get_modalidade_display()} - {self.carga_horaria_semanal}h ({self.get_status_display()})"