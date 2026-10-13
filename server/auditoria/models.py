from django.conf import settings
from django.db import models


class LogAuditoria(models.Model):
    acao = models.CharField(max_length=80)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs_auditoria",
    )
    data_hora = models.DateTimeField(auto_now_add=True)
    entidade = models.CharField(max_length=80)
    entidade_id = models.CharField(max_length=64, blank=True, default="")
    descricao = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-data_hora", "-id"]
        verbose_name = "Log de auditoria"
        verbose_name_plural = "Logs de auditoria"

    def __str__(self):
        return f"{self.acao} em {self.entidade} por {self.usuario or 'sistema'}"
