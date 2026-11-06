from django.utils import timezone

from bolsas.models import STATUS_BOLSA_FINALIZADOS, StatusBolsa

from .models import (
    CancelamentoVaga,
    OrigemVinculo,
    StatusSolicitacaoDesligamento,
    StatusVinculo,
    VinculoBolsista,
)


def vincular_por_indicacao(indicacao):
    return VinculoBolsista.objects.create(
        bolsa=indicacao.bolsa,
        aluno=indicacao.inscricao.aluno,
        origem=OrigemVinculo.SELECAO,
        indicacao=indicacao,
    )


def vincular_por_convite(convite):
    return VinculoBolsista.objects.create(
        bolsa=convite.bolsa,
        aluno=convite.aluno,
        origem=OrigemVinculo.VINCULO_DIRETO,
        convite=convite,
    )


def capacidade_efetiva(bolsa):
    """Quantidade de vagas que continuam válidas após cancelamentos individuais."""
    canceladas = CancelamentoVaga.objects.filter(vinculo__bolsa=bolsa).count()
    return max(bolsa.quantidade_vagas - canceladas, 0)


def quantidade_vinculos_ativos(bolsa):
    return bolsa.vinculos.filter(status=StatusVinculo.ATIVO).count()


def atualizar_status_preenchimento(bolsa):
    """Mantém o status da bolsa coerente com vagas efetivas e vínculos ativos."""
    if bolsa.status in STATUS_BOLSA_FINALIZADOS:
        return bolsa

    capacidade = capacidade_efetiva(bolsa)
    if capacidade == 0:
        novo_status = StatusBolsa.CANCELADA
    elif quantidade_vinculos_ativos(bolsa) >= capacidade:
        novo_status = StatusBolsa.PREENCHIDA
    else:
        novo_status = StatusBolsa.EM_SELECAO
    if bolsa.status != novo_status:
        bolsa.status = novo_status
        bolsa.save(update_fields=["status"])
    return bolsa


def efetivar_desligamento(solicitacao, responsavel):
    """Desliga o vínculo e conclui a solicitação na mesma transação da view."""
    vinculo = solicitacao.vinculo
    agora = timezone.now()

    vinculo.status = StatusVinculo.DESLIGADO
    vinculo.desligado_em = agora
    vinculo.save(update_fields=["status", "desligado_em"])

    solicitacao.status = StatusSolicitacaoDesligamento.APROVADA
    solicitacao.decidido_por = responsavel
    solicitacao.decidida_em = agora
    solicitacao.notificada_area_em = agora
    solicitacao.save(
        update_fields=[
            "status",
            "decidido_por",
            "decidida_em",
            "notificada_area_em",
        ]
    )

    atualizar_status_preenchimento(vinculo.bolsa)
    return solicitacao
