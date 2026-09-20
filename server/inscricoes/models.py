from django.conf import settings
from django.db import models
from django.db.models import Q
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from bolsas.models import Bolsa


class StatusInscricao(models.TextChoices):
    RASCUNHO = "RASCUNHO", "Rascunho"
    PENDENTE = "PENDENTE", "Pendente"
    CANCELADA = "CANCELADA", "Cancelada"


class Inscricao(models.Model):
    aluno = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="inscricoes"
    )
    bolsa = models.ForeignKey(Bolsa, on_delete=models.PROTECT, related_name="inscricoes")
    status = models.CharField(
        max_length=15, choices=StatusInscricao.choices, default=StatusInscricao.RASCUNHO
    )
    termos_aceitos = models.BooleanField(default=False)
    link_lattes = models.URLField(blank=True, default="")
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_envio = models.DateTimeField(null=True, blank=True)
    data_cancelamento = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-data_criacao"]
        constraints = [
            models.UniqueConstraint(
                fields=["aluno", "bolsa"],
                condition=~Q(status=StatusInscricao.CANCELADA),
                name="uniq_inscricao_ativa_por_aluno_e_bolsa",
            )
        ]

    def __str__(self):
        return f"{self.aluno} -> {self.bolsa} ({self.get_status_display()})"


class TipoDocumento(models.TextChoices):
    HISTORICO_ESCOLAR = "HISTORICO_ESCOLAR", "Histórico Escolar"
    COMPROVANTE_MATRICULA = "COMPROVANTE_MATRICULA", "Comprovante de Matrícula"
    ADICIONAL = "ADICIONAL", "Documento adicional"


def caminho_documento(instance, filename):
    return f"inscricoes/{instance.inscricao_id}/{instance.tipo}/{filename}"


class Documento(models.Model):
    inscricao = models.ForeignKey(Inscricao, on_delete=models.CASCADE, related_name="documentos")
    tipo = models.CharField(max_length=25, choices=TipoDocumento.choices)
    nome_original = models.CharField(max_length=255, blank=True, default="")
    arquivo = models.FileField(upload_to=caminho_documento)
    enviado_em = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.inscricao_id}"


@receiver(pre_delete, sender=Documento)
def _remover_arquivo_do_disco(sender, instance, **kwargs):
    instance.arquivo.delete(save=False)
