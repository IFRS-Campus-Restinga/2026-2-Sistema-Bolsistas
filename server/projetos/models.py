from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from accounts.models import CoordenadorProjeto

EXTENSOES_ARQUIVO_EMENTA = ["pdf", "doc", "docx"]
TAMANHO_MAX_ARQUIVO_EMENTA_MB = 10


def caminho_arquivo_ementa(instance, filename):
    return f"projetos/{instance.pk}/{filename}"


class StatusProjeto(models.TextChoices):
    ATIVO = "ATIVO", "Ativo"
    DESLIGADO = "DESLIGADO", "Desligado"


class Projeto(models.Model):
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=15, choices=StatusProjeto.choices, default=StatusProjeto.ATIVO
    )
    coordenador_projeto = models.ForeignKey(
        CoordenadorProjeto,
        on_delete=models.PROTECT,
        related_name="projetos",
    )
    arquivo_ementa = models.FileField(
        upload_to=caminho_arquivo_ementa,
        blank=True,
        default="",
        validators=[FileExtensionValidator(EXTENSOES_ARQUIVO_EMENTA)],
        help_text="Matriz curricular / ementa do projeto.",
    )
    nome_original_arquivo = models.CharField(max_length=255, blank=True, default="")
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return self.titulo


@receiver(pre_delete, sender=Projeto)
def _remover_arquivo_ementa_do_disco(sender, instance, **kwargs):
    if instance.arquivo_ementa:
        instance.arquivo_ementa.delete(save=False)
