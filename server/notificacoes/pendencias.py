"""Rotina que avisa o administrador sobre itens parados.

Roda só pelo comando `manage.py verificar_pendencias`, agendado para rodar diariamente:
consultar as notificações não grava nada. Cada administrador escolhe os prazos e quais
avisos recebe (`PreferenciasPendencias`). A chave de cada aviso (única por destinatário no
banco) evita repeti-lo.
"""

from datetime import timedelta

from django.utils import timezone

from bolsas.models import Bolsa, StatusBolsa
from inscricoes.models import Recurso, StatusRecurso

from .models import PreferenciasPendencias
from .services import Destino, Notificacao, administradores


def solicitacoes_bolsa_paradas(dias):
    limite = timezone.now() - timedelta(days=dias)
    return Bolsa.objects.filter(
        status=StatusBolsa.SOLICITADA, data_solicitacao__lt=limite
    ).select_related("projeto")


def recursos_sem_julgamento(dias):
    limite = timezone.localdate() - timedelta(days=dias)
    return Recurso.objects.filter(
        status=StatusRecurso.PENDENTE,
        inscricao__bolsa__edital__data_recurso_homologacao_fim__lt=limite,
    ).select_related("inscricao__aluno", "inscricao__bolsa__projeto")


def _dias(prazo):
    return "1 dia" if prazo == 1 else f"{prazo} dias"


def verificar_pendencias(admins=None):
    """Gera os avisos ainda não enviados e devolve quantas notificações foram criadas."""
    if admins is None:
        admins = administradores()
    criadas = 0
    for admin in admins:
        criadas += _avisar(admin, PreferenciasPendencias.de(admin))
    return criadas


def _avisar(admin, preferencias):
    criadas = 0

    if preferencias.avisar_solicitacao_parada:
        prazo = preferencias.dias_solicitacao_parada
        for bolsa in solicitacoes_bolsa_paradas(prazo):
            criadas += len(
                Notificacao.para(admin)
                .aviso()
                .titulo("Solicitação de bolsa parada")
                .mensagem(
                    f'A solicitação de bolsa do projeto "{bolsa.projeto.titulo}" aguarda '
                    f"análise do coordenador de área há mais de {_dias(prazo)}."
                )
                .destino(Destino.ADMIN_BOLSAS)
                .chave(f"bolsa-parada:{bolsa.pk}")
                .enviar()
            )

    if preferencias.avisar_recurso_parado:
        prazo = preferencias.dias_recurso_parado
        depois = f"mais de {_dias(prazo)} após" if prazo else "após"
        for recurso in recursos_sem_julgamento(prazo):
            inscricao = recurso.inscricao
            criadas += len(
                Notificacao.para(admin)
                .aviso()
                .titulo("Recurso sem julgamento")
                .mensagem(
                    f"O recurso de {inscricao.aluno.nome} na bolsa do projeto "
                    f'"{inscricao.bolsa.projeto.titulo}" segue sem julgamento {depois} o fim '
                    "do período de recursos."
                )
                .destino(Destino.ADMIN_INSCRICOES)
                .chave(f"recurso-parado:{recurso.pk}")
                .enviar()
            )

    return criadas
