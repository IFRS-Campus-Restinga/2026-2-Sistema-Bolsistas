from django.conf import settings
from django.db import models
from django.db.models import Q

from bolsas.models import Bolsa


class StatusConvite(models.TextChoices):
    PENDENTE = "PENDENTE", "Pendente"
    RECUSADO = "RECUSADO", "Recusado"
    EM_PREENCHIMENTO = "EM_PREENCHIMENTO", "Em Preenchimento"
    ENVIADO = "ENVIADO", "Enviado"
    APROVADO = "APROVADO", "Aprovado"
    REJEITADO = "REJEITADO", "Rejeitado"


STATUS_ATIVOS = [StatusConvite.PENDENTE, StatusConvite.EM_PREENCHIMENTO, StatusConvite.ENVIADO]
STATUS_OCUPAM_VAGA = [*STATUS_ATIVOS, StatusConvite.APROVADO]


class ConviteVinculoDireto(models.Model):
    bolsa = models.ForeignKey(
        Bolsa, on_delete=models.PROTECT, related_name="convites_vinculo_direto"
    )
    aluno = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="convites_vinculo_direto"
    )
    coordenador_solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="convites_enviados"
    )
    status = models.CharField(
        max_length=20, choices=StatusConvite.choices, default=StatusConvite.PENDENTE
    )
    termos_aceitos = models.BooleanField(default=False)
    link_lattes = models.URLField(blank=True, default="")
    data_envio_convite = models.DateTimeField(auto_now_add=True)
    data_resposta_aluno = models.DateTimeField(null=True, blank=True)
    data_envio_documentos = models.DateTimeField(null=True, blank=True)
    data_decisao = models.DateTimeField(null=True, blank=True)
    justificativa_rejeicao = models.TextField(blank=True, default="")
    responsavel_decisao = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="convites_vinculo_direto_analisados",
    )

    class Meta:
        ordering = ["-data_envio_convite"]
        constraints = [
            models.UniqueConstraint(
                fields=["aluno", "bolsa"],
                condition=~Q(status__in=[StatusConvite.RECUSADO, StatusConvite.REJEITADO]),
                name="uniq_convite_ativo_por_aluno_e_bolsa",
            )
        ]

    def __str__(self):
        return f"Convite {self.aluno} -> {self.bolsa} ({self.get_status_display()})"


class NotificacaoConvite(models.Model):
    convite = models.ForeignKey(
        ConviteVinculoDireto, on_delete=models.CASCADE, related_name="notificacoes"
    )
    coordenador_area = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notificacoes_vinculo_direto",
    )
    mensagem = models.TextField()
    criada_em = models.DateTimeField(auto_now_add=True)
    lida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criada_em", "-id"]

    def __str__(self):
        return f"Notificação de vínculo direto para {self.coordenador_area_id}"
