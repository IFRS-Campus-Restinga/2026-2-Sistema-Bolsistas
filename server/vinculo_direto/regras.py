from bolsas.models import StatusBolsa
from bolsistas.services import capacidade_efetiva
from inscricoes.models import StatusInscricao

from .models import STATUS_OCUPAM_VAGA

# O convite só existe depois que a coordenação de área aprova a bolsa, e enquanto ela
# está em andamento: solicitada, rejeitada, cancelada ou encerrada não aceita convite.
STATUS_ACEITAM_CONVITE = [
    StatusBolsa.ABERTA,
    StatusBolsa.EM_SELECAO,
    StatusBolsa.PREENCHIDA,
]


def vagas_livres(bolsa):
    homologadas = bolsa.inscricoes.filter(status=StatusInscricao.HOMOLOGADA).count()
    ocupadas_por_convite = bolsa.convites_vinculo_direto.filter(
        status__in=STATUS_OCUPAM_VAGA
    ).count()
    return capacidade_efetiva(bolsa) - homologadas - ocupadas_por_convite


def bolsa_elegivel_para_convite(bolsa):
    return (
        bolsa.status in STATUS_ACEITAM_CONVITE
        and bolsa.edital.recursos_homologacao_encerrados()
        and vagas_livres(bolsa) > 0
    )
