from django.conf import settings
from django.db import models
from django.utils import timezone


class TomNotificacao(models.TextChoices):
    INFO = "INFO", "Informação"
    SUCESSO = "SUCESSO", "Sucesso"
    AVISO = "AVISO", "Aviso"
    ERRO = "ERRO", "Erro"


class Notificacao(models.Model):
    """Notificação exibida na central (sino) de qualquer perfil.

    `destino` é o id da aba da tela do destinatário que o clique abre (ex.: "inscricoes").
    `chave` identifica avisos de rotina para não repeti-los ao mesmo destinatário.
    """

    destinatario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacoes",
    )
    tom = models.CharField(
        max_length=10, choices=TomNotificacao.choices, default=TomNotificacao.INFO
    )
    titulo = models.CharField(max_length=150)
    mensagem = models.TextField()
    destino = models.CharField(max_length=50, blank=True, default="")
    chave = models.CharField(max_length=100, blank=True, default="")
    # default em vez de auto_now_add: a migração dos modelos antigos preserva a data original.
    criada_em = models.DateTimeField(default=timezone.now)
    lida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criada_em", "-id"]
        verbose_name = "notificação"
        verbose_name_plural = "notificações"
        indexes = [models.Index(fields=["destinatario", "lida_em"])]

    def __str__(self):
        return f"{self.titulo} → {self.destinatario_id}"
