from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from bolsas.models import STATUS_BOLSA_FINALIZADOS, StatusBolsa
from notificacoes.services import Destino, Notificacao, coordenadores_da_bolsa

from .models import (
    CancelamentoVaga,
    OrigemVinculo,
    StatusSolicitacaoDesligamento,
    StatusVinculo,
    VinculoBolsista,
)

MOTIVO_ALUNO_JA_BOLSISTA = "Este aluno já é bolsista ativo de outra bolsa."
MOTIVO_VOCE_JA_E_BOLSISTA = "Você já é bolsista ativo de outra bolsa."


def vinculos_vigentes():
    """Vínculos que ainda contam como bolsa em andamento. Finalizar a bolsa (ENCERRADA) não
    muda o status dos vínculos, que seguem ATIVO para o histórico e os relatórios; por isso a
    bolsa encerrada fica de fora aqui."""
    return VinculoBolsista.objects.filter(status=StatusVinculo.ATIVO).exclude(
        bolsa__status=StatusBolsa.ENCERRADA
    )


# O vínculo aguardando o termo de compromisso é provisório, mas já reserva a vaga.
STATUS_VINCULO_OCUPA_VAGA = [
    StatusVinculo.AGUARDANDO_TERMO,
    StatusVinculo.ATIVO,
]


def vinculos_em_andamento():
    """Vínculos vigentes mais os provisórios (aguardando termo): é o que impede o aluno de
    assumir outra bolsa."""
    return VinculoBolsista.objects.filter(status__in=STATUS_VINCULO_OCUPA_VAGA).exclude(
        bolsa__status=StatusBolsa.ENCERRADA
    )


def tem_vinculo_ativo(aluno):
    return vinculos_em_andamento().filter(aluno=aluno).exists()


def alunos_com_vinculo_ativo(alunos):
    return set(vinculos_em_andamento().filter(aluno__in=alunos).values_list("aluno_id", flat=True))


def _garantir_sem_vinculo_ativo(aluno):
    """O aluno só pode ter um vínculo ativo. Trava o aluno para que duas
    aprovações simultâneas não passem as duas pela checagem."""
    get_user_model().objects.select_for_update().filter(pk=aluno.pk).first()
    if tem_vinculo_ativo(aluno):
        raise ValidationError({"detail": MOTIVO_ALUNO_JA_BOLSISTA})


def vincular_por_indicacao(indicacao):
    _garantir_sem_vinculo_ativo(indicacao.inscricao.aluno)
    return VinculoBolsista.objects.create(
        bolsa=indicacao.bolsa,
        aluno=indicacao.inscricao.aluno,
        origem=OrigemVinculo.SELECAO,
        indicacao=indicacao,
        status=StatusVinculo.AGUARDANDO_TERMO,
    )


def vincular_por_convite(convite):
    _garantir_sem_vinculo_ativo(convite.aluno)
    return VinculoBolsista.objects.create(
        bolsa=convite.bolsa,
        aluno=convite.aluno,
        origem=OrigemVinculo.VINCULO_DIRETO,
        convite=convite,
        status=StatusVinculo.AGUARDANDO_TERMO,
    )


def capacidade_efetiva(bolsa):
    """Quantidade de vagas que continuam válidas após cancelamentos individuais."""
    canceladas = CancelamentoVaga.objects.filter(vinculo__bolsa=bolsa).count()
    return max(bolsa.quantidade_vagas - canceladas, 0)


def quantidade_vinculos_ocupantes(bolsa):
    """Conta vínculos que já reservam uma vaga, mesmo antes da assinatura do termo."""
    return bolsa.vinculos.filter(status__in=STATUS_VINCULO_OCUPA_VAGA).count()


def atualizar_status_preenchimento(bolsa):
    """Mantém o status da bolsa coerente com vagas efetivas e vínculos ativos."""
    if bolsa.status in STATUS_BOLSA_FINALIZADOS:
        return bolsa

    capacidade = capacidade_efetiva(bolsa)
    if capacidade == 0:
        novo_status = StatusBolsa.CANCELADA
    elif quantidade_vinculos_ocupantes(bolsa) >= capacidade:
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

    bolsa = vinculo.bolsa
    Notificacao.para(coordenadores_da_bolsa(bolsa)).aviso().titulo("Bolsista desligado").mensagem(
        f"{vinculo.aluno.nome} foi desligado(a) da bolsa do projeto "
        f'"{bolsa.projeto.titulo}". Motivo: {solicitacao.motivo}'
    ).destino(Destino.AREA_MOVIMENTACOES).enviar()

    atualizar_status_preenchimento(bolsa)
    return solicitacao
