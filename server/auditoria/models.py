from django.conf import settings
from django.db import models


class AcaoAuditoria(models.TextChoices):
    CRIACAO = "CRIACAO", "Criação"
    ATUALIZACAO = "ATUALIZACAO", "Atualização"
    EXCLUSAO = "EXCLUSAO", "Exclusão"
    PUBLICACAO = "PUBLICACAO", "Publicação"
    ENCERRAMENTO = "ENCERRAMENTO", "Encerramento"
    CANCELAMENTO = "CANCELAMENTO", "Cancelamento"
    APROVACAO = "APROVACAO", "Aprovação"
    REJEICAO = "REJEICAO", "Rejeição"
    ATIVACAO = "ATIVACAO", "Ativação"
    DESATIVACAO = "DESATIVACAO", "Desativação"
    VINCULO = "VINCULO", "Vínculo"
    DESISTENCIA = "DESISTENCIA", "Desistência"


class EntidadeAuditoria(models.TextChoices):
    EDITAL = "EDITAL", "Edital"
    BOLSA = "BOLSA", "Bolsa"
    SELECAO = "SELECAO", "Seleção"
    USUARIO = "USUARIO", "Usuário"
    COORDENADOR_AREA = "COORDENADOR_AREA", "Coordenador de Área"
    DADOS_BANCARIOS = "DADOS_BANCARIOS", "Dados Bancários"


class LogAuditoria(models.Model):
    acao = models.CharField(max_length=20, choices=AcaoAuditoria.choices)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="logs_auditoria",
    )
    data_hora = models.DateTimeField(auto_now_add=True)
    entidade = models.CharField(max_length=20, choices=EntidadeAuditoria.choices)
    entidade_id = models.CharField(max_length=64, blank=True, default="")
    descricao = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-data_hora", "-id"]
        verbose_name = "Log de auditoria"
        verbose_name_plural = "Logs de auditoria"

    def __str__(self):
        return f"{self.get_acao_display()} · {self.get_entidade_display()}"
