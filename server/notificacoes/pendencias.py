"""Rotina que avisa o administrador sobre itens parados.

Roda pelo comando `manage.py verificar_pendencias` (para agendar) e sempre que um
administrador consulta as notificações. A chave de cada aviso evita repeti-lo.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from bolsas.models import Bolsa, StatusBolsa
from inscricoes.models import Recurso, StatusRecurso

from .services import Destino, Notificacao, administradores


def solicitacoes_bolsa_paradas():
    limite = timezone.now() - timedelta(days=settings.PRAZO_ANALISE_SOLICITACAO_BOLSA_DIAS)
    return Bolsa.objects.filter(
        status=StatusBolsa.SOLICITADA, data_solicitacao__lt=limite
    ).select_related("projeto")


def recursos_sem_julgamento():
    return Recurso.objects.filter(
        status=StatusRecurso.PENDENTE,
        inscricao__bolsa__edital__data_recurso_homologacao_fim__lt=timezone.localdate(),
    ).select_related("inscricao__aluno", "inscricao__bolsa__projeto")


def verificar_pendencias():
    """Gera os avisos ainda não enviados e devolve quantas notificações foram criadas."""
    admins = list(administradores())
    if not admins:
        return 0

    prazo = settings.PRAZO_ANALISE_SOLICITACAO_BOLSA_DIAS
    criadas = 0

    for bolsa in solicitacoes_bolsa_paradas():
        criadas += len(
            Notificacao.para(admins)
            .aviso()
            .titulo("Solicitação de bolsa parada")
            .mensagem(
                f'A solicitação de bolsa do projeto "{bolsa.projeto.titulo}" aguarda análise '
                f"do coordenador de área há mais de {prazo} dias."
            )
            .destino(Destino.ADMIN_BOLSAS)
            .chave(f"bolsa-parada:{bolsa.pk}")
            .enviar()
        )

    for recurso in recursos_sem_julgamento():
        inscricao = recurso.inscricao
        criadas += len(
            Notificacao.para(admins)
            .aviso()
            .titulo("Recurso sem julgamento")
            .mensagem(
                f"O recurso de {inscricao.aluno.nome} na bolsa do projeto "
                f'"{inscricao.bolsa.projeto.titulo}" segue sem julgamento após o fim do '
                "período de recursos."
            )
            .destino(Destino.ADMIN_INSCRICOES)
            .chave(f"recurso-parado:{recurso.pk}")
            .enviar()
        )

    return criadas
