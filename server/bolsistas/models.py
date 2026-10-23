from django.conf import settings
from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models import Q
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils import timezone

from bolsas.models import Bolsa


class OrigemVinculo(models.TextChoices):
    SELECAO = "SELECAO", "Seleção"
    VINCULO_DIRETO = "VINCULO_DIRETO", "Vínculo direto"


class VinculoBolsista(models.Model):
    """O aluno como bolsista de uma bolsa, venha ele da seleção ou do vínculo direto."""

    bolsa = models.ForeignKey(Bolsa, on_delete=models.PROTECT, related_name="vinculos")
    aluno = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="vinculos_bolsista"
    )
    origem = models.CharField(max_length=15, choices=OrigemVinculo.choices)
    indicacao = models.OneToOneField(
        "selecao.IndicacaoBolsista",
        on_delete=models.PROTECT,
        related_name="vinculo",
        null=True,
        blank=True,
    )
    convite = models.OneToOneField(
        "vinculo_direto.ConviteVinculoDireto",
        on_delete=models.PROTECT,
        related_name="vinculo",
        null=True,
        blank=True,
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["criado_em", "id"]
        verbose_name = "vínculo de bolsista"
        verbose_name_plural = "vínculos de bolsista"
        constraints = [
            models.UniqueConstraint(
                fields=["bolsa", "aluno"], name="uniq_vinculo_por_bolsa_e_aluno"
            ),
            models.CheckConstraint(
                condition=(
                    Q(origem="SELECAO", indicacao__isnull=False, convite__isnull=True)
                    | Q(origem="VINCULO_DIRETO", indicacao__isnull=True, convite__isnull=False)
                ),
                name="vinculo_origem_coerente",
            ),
        ]

    def __str__(self):
        return f"{self.aluno} na bolsa {self.bolsa_id} ({self.get_origem_display()})"


class SituacaoRelatorio(models.TextChoices):
    SOLICITADO = "SOLICITADO", "Solicitado"
    AGUARDANDO_AVALIACAO = "AGUARDANDO_AVALIACAO", "Aguardando avaliação"
    APROVADO = "APROVADO", "Aprovado"
    REPROVADO = "REPROVADO", "Reprovado"


SITUACOES_QUE_ACEITAM_ENVIO = [
    SituacaoRelatorio.SOLICITADO,
    SituacaoRelatorio.AGUARDANDO_AVALIACAO,
    SituacaoRelatorio.REPROVADO,
]

EXTENSOES_RELATORIO = ["pdf"]
TAMANHO_MAX_RELATORIO_MB = 10


def caminho_relatorio(instance, filename):
    return f"relatorios_finais/{instance.vinculo_id}/{filename}"


class RelatorioFinal(models.Model):
    """Relatório final do bolsista.

    Nasce quando o coordenador do projeto o solicita; o aluno envia o arquivo, e um reenvio
    substitui o arquivo e volta para avaliação.
    """

    vinculo = models.OneToOneField(
        VinculoBolsista, on_delete=models.CASCADE, related_name="relatorio_final"
    )
    solicitado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="relatorios_solicitados"
    )
    solicitado_em = models.DateTimeField(default=timezone.now)
    arquivo = models.FileField(
        upload_to=caminho_relatorio,
        validators=[FileExtensionValidator(EXTENSOES_RELATORIO)],
        blank=True,
    )
    nome_original = models.CharField(max_length=255, blank=True, default="")
    enviado_em = models.DateTimeField(null=True, blank=True)
    situacao = models.CharField(
        max_length=25,
        choices=SituacaoRelatorio.choices,
        default=SituacaoRelatorio.SOLICITADO,
    )
    justificativa = models.TextField(blank=True, default="")
    avaliado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="relatorios_avaliados",
        null=True,
        blank=True,
    )
    avaliado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "relatório final"
        verbose_name_plural = "relatórios finais"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(situacao="SOLICITADO", arquivo="", enviado_em__isnull=True)
                    | (~Q(situacao="SOLICITADO") & ~Q(arquivo="") & Q(enviado_em__isnull=False))
                ),
                name="relatorio_arquivo_coerente_com_situacao",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        situacao__in=["SOLICITADO", "AGUARDANDO_AVALIACAO"],
                        avaliado_por__isnull=True,
                        avaliado_em__isnull=True,
                    )
                    | Q(
                        situacao__in=["APROVADO", "REPROVADO"],
                        avaliado_por__isnull=False,
                        avaliado_em__isnull=False,
                    )
                ),
                name="relatorio_parecer_coerente_com_situacao",
            ),
            models.CheckConstraint(
                condition=~Q(situacao="REPROVADO", justificativa=""),
                name="relatorio_reprovado_exige_justificativa",
            ),
        ]

    def __str__(self):
        return f"Relatório final do vínculo {self.vinculo_id} ({self.get_situacao_display()})"

    @property
    def aceita_envio(self):
        return self.situacao in SITUACOES_QUE_ACEITAM_ENVIO


@receiver(pre_delete, sender=RelatorioFinal)
def _remover_relatorio_do_disco(sender, instance, **kwargs):
    instance.arquivo.delete(save=False)
