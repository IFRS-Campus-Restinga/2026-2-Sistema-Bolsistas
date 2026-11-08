"""Contadores de pendências exibidos ao lado dos itens da sidebar, por perfil.

As chaves são os ids das tabs do frontend; cada contagem usa o mesmo filtro da tela
correspondente, para o número bater com o que a tela mostra.
"""

from accounts.models import Usuario
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from bolsistas.models import (
    CancelamentoVaga,
    RelatorioFinal,
    SituacaoRelatorio,
    SolicitacaoDesligamento,
    StatusSolicitacaoDesligamento,
    StatusVinculo,
)
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso
from vinculo_direto.models import ConviteVinculoDireto, StatusConvite


def _aluno(usuario):
    return {
        "convites": ConviteVinculoDireto.objects.filter(
            aluno=usuario, status=StatusConvite.PENDENTE
        ).count(),
    }


def _coordenador_projeto(usuario):
    do_coordenador = {"bolsa__projeto__coordenador_projeto__usuario": usuario}
    inscricoes = Inscricao.objects.filter(status=StatusInscricao.PENDENTE, **do_coordenador)
    recursos = Recurso.objects.filter(
        status=StatusRecurso.PENDENTE,
        inscricao__bolsa__projeto__coordenador_projeto__usuario=usuario,
    )
    return {
        "selecao": inscricoes.count() + recursos.count(),
        "convites": ConviteVinculoDireto.objects.filter(
            status=StatusConvite.ENVIADO, **do_coordenador
        ).count(),
        "finalizacao": RelatorioFinal.objects.filter(
            situacao=SituacaoRelatorio.AGUARDANDO_AVALIACAO,
            vinculo__status=StatusVinculo.ATIVO,
            vinculo__bolsa__projeto__coordenador_projeto__usuario=usuario,
        ).count(),
    }


def _coordenador_area(usuario):
    tipos = [usuario.perfil_coordenador_area.tipo_area, TipoBolsa.INDISSOCIAVEL]
    da_area = {"vinculo__bolsa__coordenador_area__usuario": usuario}
    desligamentos = SolicitacaoDesligamento.objects.filter(
        status=StatusSolicitacaoDesligamento.APROVADA, ciencia_area_em__isnull=True, **da_area
    )
    cancelamentos = CancelamentoVaga.objects.filter(ciencia_area_em__isnull=True, **da_area)
    return {
        "solicitacoes": Bolsa.objects.filter(tipo__in=tipos, status=StatusBolsa.SOLICITADA).count(),
        "movimentacoes": desligamentos.count() + cancelamentos.count(),
        "finalizacao": Bolsa.objects.filter(
            tipo__in=tipos,
            status=StatusBolsa.ENCERRADA,
            finalizada_em__isnull=False,
            ciencia_finalizacao_em__isnull=True,
        ).count(),
    }


CONTADORES_POR_PERFIL = {
    Usuario.Role.ALUNO: _aluno,
    Usuario.Role.COORDENADOR_PROJETO: _coordenador_projeto,
    Usuario.Role.COORDENADOR_AREA: _coordenador_area,
}


def contadores_do_menu(usuario):
    calcular = CONTADORES_POR_PERFIL.get(usuario.role)
    return calcular(usuario) if calcular else {}
