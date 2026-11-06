from django.conf import settings
from django.db import models
from django.db.models import Q

from bolsistas.models import VinculoBolsista


class StatusFrequencia(models.TextChoices):
    """Situação de um bolsista em um mês, vista no painel do coordenador de área."""

    REGISTRADA = "REGISTRADA", "Registrada"
    NAO_REGISTRADA = "NAO_REGISTRADA", "Não Registrada"
    NAO_INFORMADO = "NAO_INFORMADO", "Não Informado"


class StatusPagamento(models.TextChoices):
    PENDENTE = "PENDENTE", "Pendente"
    AUTORIZADO = "AUTORIZADO", "Autorizado"
    NEGADO = "NEGADO", "Negado"


class Frequencia(models.Model):
    """Frequência mensal de um bolsista, lançada pelo coordenador do projeto.

    `registrada` diz se o bolsista cumpriu a frequência do mês; sem lançamento, o mês fica
    "Não Informado". O pagamento é só um status interno: o processamento financeiro
    continua fora do sistema.
    """

    vinculo = models.ForeignKey(
        VinculoBolsista, on_delete=models.PROTECT, related_name="frequencias"
    )
    mes_referencia = models.DateField(help_text="Sempre o primeiro dia do mês de referência.")
    registrada = models.BooleanField()
    observacoes = models.TextField(blank=True, default="")
    lancada_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="frequencias_lancadas"
    )
    lancada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)
    # Calculado no primeiro lançamento: mudar o prazo do edital depois não reescreve o passado.
    fora_do_prazo = models.BooleanField(default=False)
    status_pagamento = models.CharField(
        max_length=10,
        choices=StatusPagamento.choices,
        default=StatusPagamento.PENDENTE,
    )
    justificativa_pagamento = models.TextField(blank=True, default="")
    pagamento_decidido_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pagamentos_decididos",
        null=True,
        blank=True,
    )
    pagamento_decidido_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-mes_referencia", "vinculo__aluno__nome"]
        verbose_name = "frequência"
        verbose_name_plural = "frequências"
        constraints = [
            models.UniqueConstraint(
                fields=["vinculo", "mes_referencia"], name="uniq_frequencia_por_vinculo_e_mes"
            ),
            models.CheckConstraint(
                condition=Q(mes_referencia__day=1),
                name="frequencia_mes_no_primeiro_dia",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        status_pagamento="PENDENTE",
                        pagamento_decidido_por__isnull=True,
                        pagamento_decidido_em__isnull=True,
                    )
                    | Q(
                        status_pagamento__in=["AUTORIZADO", "NEGADO"],
                        pagamento_decidido_por__isnull=False,
                        pagamento_decidido_em__isnull=False,
                    )
                ),
                name="frequencia_decisao_coerente_com_pagamento",
            ),
            models.CheckConstraint(
                condition=~Q(status_pagamento="NEGADO", justificativa_pagamento=""),
                name="frequencia_pagamento_negado_exige_justificativa",
            ),
        ]

    def __str__(self):
        return f"Frequência de {self.vinculo.aluno} em {self.mes_referencia:%m/%Y}"

    @property
    def status(self):
        return StatusFrequencia.REGISTRADA if self.registrada else StatusFrequencia.NAO_REGISTRADA


class SolicitacaoFrequencia(models.Model):
    """Cobrança do coordenador de área para o lançamento de uma frequência em atraso.

    Também é a notificação do coordenador do projeto: `lida_em` marca a ciência e
    `atendida_em` é preenchido quando a frequência do mês é lançada.
    """

    vinculo = models.ForeignKey(
        VinculoBolsista, on_delete=models.PROTECT, related_name="solicitacoes_frequencia"
    )
    mes_referencia = models.DateField()
    solicitante = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="frequencias_solicitadas",
    )
    mensagem = models.TextField(blank=True, default="")
    criada_em = models.DateTimeField(auto_now_add=True)
    lida_em = models.DateTimeField(null=True, blank=True)
    atendida_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criada_em", "-id"]
        verbose_name = "solicitação de frequência"
        verbose_name_plural = "solicitações de frequência"
        constraints = [
            models.UniqueConstraint(
                fields=["vinculo", "mes_referencia"],
                condition=Q(atendida_em__isnull=True),
                name="uniq_solicitacao_frequencia_aberta",
            ),
            models.CheckConstraint(
                condition=Q(mes_referencia__day=1),
                name="solicitacao_frequencia_mes_no_primeiro_dia",
            ),
        ]

    def __str__(self):
        return (
            f"Solicitação de frequência do vínculo {self.vinculo_id} em {self.mes_referencia:%m/%Y}"
        )
