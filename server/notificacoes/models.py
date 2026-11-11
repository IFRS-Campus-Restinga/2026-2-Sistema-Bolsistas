from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
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
        constraints = [
            models.UniqueConstraint(
                fields=["destinatario", "chave"],
                condition=~models.Q(chave=""),
                name="notificacao_chave_unica_por_destinatario",
            )
        ]

    def __str__(self):
        return f"{self.titulo} → {self.destinatario_id}"


class PreferenciasPendencias(models.Model):
    """Quanto tempo um item pode ficar parado antes de avisar o administrador.

    Cada administrador ajusta as suas na aba "Configurar" do sino; sem registro valem os
    padrões dos campos.
    """

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="preferencias_pendencias",
    )
    avisar_solicitacao_parada = models.BooleanField(default=True)
    dias_solicitacao_parada = models.PositiveSmallIntegerField(
        default=5,
        validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text="Dias que uma solicitação de bolsa pode aguardar análise.",
    )
    avisar_recurso_parado = models.BooleanField(default=True)
    dias_recurso_parado = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(365)],
        help_text="Dias após o fim do período de recursos sem julgamento.",
    )

    class Meta:
        verbose_name = "preferências de pendências"
        verbose_name_plural = "preferências de pendências"

    def __str__(self):
        return f"Pendências de {self.usuario_id}"

    @classmethod
    def de(cls, usuario):
        """Preferências do usuário, ou as padrão (sem salvar) se ele nunca ajustou."""
        return cls.objects.filter(usuario=usuario).first() or cls(usuario=usuario)
