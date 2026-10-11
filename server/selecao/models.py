from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from bolsas.models import Bolsa, EtapaAvaliacao
from inscricoes.models import Inscricao

NOTA_MAXIMA = Decimal("10")


class SituacaoClassificacao(models.TextChoices):
    TITULAR = "TITULAR", "Titular"
    SUPLENTE = "SUPLENTE", "Suplente"
    DESCLASSIFICADO = "DESCLASSIFICADO", "Desclassificado"


class NotaEtapa(models.Model):
    inscricao = models.ForeignKey(Inscricao, on_delete=models.CASCADE, related_name="notas_etapas")
    etapa = models.ForeignKey(EtapaAvaliacao, on_delete=models.PROTECT, related_name="notas")
    nota = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(NOTA_MAXIMA)],
    )
    lancada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="notas_lancadas"
    )
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["etapa_id"]
        verbose_name = "nota de etapa"
        verbose_name_plural = "notas de etapa"
        constraints = [
            models.UniqueConstraint(fields=["inscricao", "etapa"], name="uniq_nota_por_etapa")
        ]

    def __str__(self):
        return f"Inscrição {self.inscricao_id} - {self.etapa.nome}: {self.nota}"


class DesempateClassificacao(models.Model):
    """Ordem definida pelo coordenador entre candidatos com a mesma nota final."""

    inscricao = models.OneToOneField(Inscricao, on_delete=models.CASCADE, related_name="desempate")
    ordem = models.PositiveIntegerField()

    def __str__(self):
        return f"Inscrição {self.inscricao_id}: {self.ordem}"


class PublicacaoResultado(models.Model):
    bolsa = models.OneToOneField(
        Bolsa, on_delete=models.PROTECT, related_name="publicacao_resultado"
    )
    publicado_em = models.DateTimeField(auto_now_add=True)
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="resultados_publicados"
    )

    def __str__(self):
        return f"Resultado da bolsa {self.bolsa_id}"


class ResultadoInscricao(models.Model):
    """Retrato oficial da classificação no momento da publicação."""

    publicacao = models.ForeignKey(
        PublicacaoResultado, on_delete=models.CASCADE, related_name="resultados"
    )
    inscricao = models.OneToOneField(
        Inscricao, on_delete=models.PROTECT, related_name="resultado_selecao"
    )
    posicao = models.PositiveIntegerField(null=True, blank=True)
    nota_final = models.DecimalField(max_digits=4, decimal_places=2)
    situacao = models.CharField(max_length=15, choices=SituacaoClassificacao.choices)

    class Meta:
        ordering = ["publicacao", "posicao", "-nota_final", "id"]

    def __str__(self):
        return f"{self.inscricao_id}: {self.get_situacao_display()}"


class IndicacaoBolsista(models.Model):
    bolsa = models.ForeignKey(Bolsa, on_delete=models.PROTECT, related_name="indicacoes")
    inscricao = models.OneToOneField(
        Inscricao, on_delete=models.PROTECT, related_name="indicacao_bolsista"
    )
    justificativa = models.TextField(blank=True, default="")
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="indicacoes_bolsista"
    )
    indicado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["indicado_em", "id"]
        verbose_name = "indicação de bolsista"
        verbose_name_plural = "indicações de bolsista"

    def __str__(self):
        return f"Indicação da inscrição {self.inscricao_id}"


class DesistenciaVaga(models.Model):
    """Candidato classificado que não vai assumir a vaga; libera a vaga para um suplente."""

    bolsa = models.ForeignKey(Bolsa, on_delete=models.PROTECT, related_name="desistencias")
    inscricao = models.OneToOneField(
        Inscricao, on_delete=models.PROTECT, related_name="desistencia_vaga"
    )
    motivo = models.TextField()
    responsavel = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="desistencias_registradas"
    )
    registrada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["registrada_em", "id"]
        verbose_name = "candidato que não assumiu"
        verbose_name_plural = "candidatos que não assumiram"

    def __str__(self):
        return f"Inscrição {self.inscricao_id} não assumiu"
