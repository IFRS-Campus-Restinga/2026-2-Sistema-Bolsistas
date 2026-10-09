from django.db import models

from accounts.models import Aluno


def caminho_comprovante(instance, filename):
    return f"dados_bancarios/{instance.aluno_id}/{filename}"


class DadosBancarios(models.Model):
    aluno = models.OneToOneField(
        Aluno,
        on_delete=models.CASCADE,
        related_name="dados_bancarios",
    )
    banco = models.CharField(max_length=100)
    agencia = models.CharField(max_length=30)
    conta = models.CharField(max_length=30)
    comprovante = models.FileField(
        upload_to=caminho_comprovante,
        blank=True,
    )

    class Meta:
        verbose_name = "Dados bancários"
        verbose_name_plural = "Dados bancários"

    def __str__(self):
        return f"Dados bancários de {self.aluno.usuario}"
