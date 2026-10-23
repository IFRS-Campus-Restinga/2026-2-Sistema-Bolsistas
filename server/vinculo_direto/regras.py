from bolsas.models import STATUS_BOLSA_FINALIZADOS
from bolsistas.services import capacidade_efetiva
from inscricoes.models import StatusInscricao

from .models import STATUS_OCUPAM_VAGA


def vagas_livres(bolsa):
    homologadas = bolsa.inscricoes.filter(status=StatusInscricao.HOMOLOGADA).count()
    ocupadas_por_convite = bolsa.convites_vinculo_direto.filter(
        status__in=STATUS_OCUPAM_VAGA
    ).count()
    return capacidade_efetiva(bolsa) - homologadas - ocupadas_por_convite


def bolsa_elegivel_para_convite(bolsa):
    return (
        bolsa.status not in STATUS_BOLSA_FINALIZADOS
        and bolsa.edital.recursos_homologacao_encerrados()
        and vagas_livres(bolsa) > 0
    )
