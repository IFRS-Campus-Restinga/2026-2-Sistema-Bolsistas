"""Números dos painéis iniciais (US92), calculados no escopo de cada perfil.

Cada item de "requer atenção" usa o mesmo filtro da tela para onde leva, para o
número bater com o que a tela mostra.
"""

from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from accounts.models import Usuario
from bolsas.models import Bolsa, EtapaAvaliacao, StatusBolsa, TipoBolsa, fim_vigencia_efetivo
from bolsas.views import _bolsas_disponiveis_qs
from bolsistas.models import (
    OrigemVinculo,
    SolicitacaoDesligamento,
    StatusSolicitacaoDesligamento,
    StatusVinculo,
)
from bolsistas.regras import motivos_bloqueio_finalizacao
from bolsistas.services import vinculos_em_andamento, vinculos_vigentes
from bolsistas.termos import motivo_dados_termo_incompletos
from dados_bancarios.models import DadosBancarios
from dados_bancarios.serializers import DadosBancariosSerializer
from editais.models import Edital
from frequencias.models import Frequencia, StatusPagamento
from frequencias.regras import meses_do_vinculo, prazo_do_mes, primeiro_dia
from frequencias.services import pendencias_da_area
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso
from projetos.models import Projeto
from vinculo_direto.models import ConviteVinculoDireto, StatusConvite

from .contadores import STATUS_BOLSA_EM_SELECAO, contadores_do_menu

STATUS_BOLSA_EM_ANDAMENTO = [StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO, StatusBolsa.PREENCHIDA]
STATUS_POR_SITUACAO = [StatusBolsa.SOLICITADA, *STATUS_BOLSA_EM_ANDAMENTO]

# Datas do edital mostradas em "Próximos prazos", como no protótipo.
PRAZOS_DO_EDITAL = [
    ("data_fechamento_inscricoes", "Fechamento das inscrições"),
    ("data_homologacao", "Homologação"),
    ("data_resultado", "Resultado final"),
]
MAX_PRAZOS = 4


def proximos_prazos(editais, hoje):
    """As próximas datas (de hoje em diante) dos editais, da mais próxima à mais distante.
    `dias` vem do servidor para a tela não depender do relógio do navegador."""
    prazos = [
        {"rotulo": rotulo, "data": data, "dias": (data - hoje).days, "edital": edital.ano_codigo}
        for edital in editais
        for campo, rotulo in PRAZOS_DO_EDITAL
        if (data := getattr(edital, campo)) and data >= hoje
    ]
    prazos.sort(key=lambda prazo: (prazo["data"], prazo["edital"]))
    return prazos[:MAX_PRAZOS]


def painel_da_area(usuario, hoje=None):
    hoje = hoje or timezone.localdate()
    tipos = [usuario.perfil_coordenador_area.tipo_area, TipoBolsa.INDISSOCIAVEL]
    bolsas = Bolsa.objects.filter(tipo__in=tipos)
    por_status = dict(
        bolsas.values_list("status").annotate(total=Count("id")).values_list("status", "total")
    )
    vinculos_ativos = vinculos_vigentes().filter(bolsa__tipo__in=tipos)
    editais_em_vigor = Edital.objects.filter(status=Edital.Status.EM_VIGOR)
    contadores = contadores_do_menu(usuario)

    return {
        "editais_em_vigor": editais_em_vigor.count(),
        "bolsas_da_area": sum(por_status.get(s, 0) for s in STATUS_BOLSA_EM_ANDAMENTO),
        "bolsas_aguardando_analise": por_status.get(StatusBolsa.SOLICITADA, 0),
        "bolsistas_ativos": vinculos_ativos.count(),
        "pagamentos_a_autorizar": Frequencia.objects.filter(
            vinculo__in=vinculos_ativos, status_pagamento=StatusPagamento.PENDENTE
        ).count(),
        "atencao": {
            "solicitacoes": contadores["solicitacoes"],
            "movimentacoes": contadores["movimentacoes"],
            "frequencias_em_atraso": sum(
                len(grupo["frequencias"]) for grupo in pendencias_da_area(usuario, hoje)
            ),
            "finalizacoes": contadores["finalizacao"],
            "vigencias_encerradas": _vigencias_encerradas(bolsas, hoje).count(),
        },
        "proximos_prazos": proximos_prazos(editais_em_vigor, hoje),
        "bolsas_por_situacao": [
            {"status": s, "total": por_status.get(s, 0)} for s in STATUS_POR_SITUACAO
        ],
        "total_bolsas": sum(por_status.get(s, 0) for s in STATUS_POR_SITUACAO),
    }


def _vigencias_encerradas(bolsas, hoje):
    """Bolsas em andamento cujo fim da vigência já passou e que ainda não foram finalizadas."""
    return (
        bolsas.filter(status__in=STATUS_BOLSA_EM_ANDAMENTO)
        .annotate(fim=fim_vigencia_efetivo())
        .filter(fim__lt=hoje)
    )


def _frequencias_do_mes_anterior(vinculos_ativos, hoje):
    """Bolsistas ativos sem frequência lançada no mês anterior e o prazo mais próximo."""
    mes = primeiro_dia(primeiro_dia(hoje) - timedelta(days=1))
    lancadas = set(
        Frequencia.objects.filter(vinculo__in=vinculos_ativos, mes_referencia=mes).values_list(
            "vinculo_id", flat=True
        )
    )
    faltando = [
        vinculo
        for vinculo in vinculos_ativos.select_related("aluno", "bolsa__edital")
        if vinculo.id not in lancadas and mes in meses_do_vinculo(vinculo, hoje)
    ]
    prazos = [p for v in faltando if (p := prazo_do_mes(v.bolsa.edital, mes))]
    return {
        "mes_referencia": mes,
        "prazo": min(prazos) if prazos else None,
        "bolsistas": [
            {"vinculo_id": v.id, "aluno_nome": v.aluno.nome}
            for v in sorted(faltando, key=lambda v: v.aluno.nome)
        ],
    }


def _agenda_de_avaliacoes(bolsas):
    etapas = (
        EtapaAvaliacao.objects.filter(bolsa__in=bolsas, data_hora__gte=timezone.now())
        .select_related("bolsa")
        .order_by("data_hora", "id")
    )
    return [
        {
            "id": etapa.id,
            "nome": etapa.nome,
            "data_hora": etapa.data_hora,
            "local": etapa.local,
            "bolsa_modalidade": etapa.bolsa.modalidade,
            "bolsa_carga_horaria": etapa.bolsa.carga_horaria_semanal,
        }
        for etapa in etapas
    ]


def painel_do_coordenador_projeto(usuario, hoje=None):
    hoje = hoje or timezone.localdate()
    do_coordenador = {"projeto__coordenador_projeto__usuario": usuario}
    bolsas = Bolsa.objects.filter(**do_coordenador)
    vinculos_ativos = vinculos_vigentes().filter(
        bolsa__projeto__coordenador_projeto__usuario=usuario
    )
    inscricoes_pendentes = Inscricao.objects.filter(
        status=StatusInscricao.PENDENTE,
        bolsa__status__in=STATUS_BOLSA_EM_SELECAO,
        bolsa__projeto__coordenador_projeto__usuario=usuario,
    ).count()
    contadores = contadores_do_menu(usuario)
    prontas = [
        bolsa
        for bolsa in bolsas.filter(status__in=STATUS_BOLSA_EM_ANDAMENTO)
        if not motivos_bloqueio_finalizacao(bolsa)
    ]

    return {
        "projetos": Projeto.objects.filter(coordenador_projeto__usuario=usuario).count(),
        "bolsas_abertas": bolsas.filter(status__in=STATUS_BOLSA_EM_SELECAO).count(),
        "bolsas_aguardando_aprovacao": bolsas.filter(status=StatusBolsa.SOLICITADA).count(),
        "inscricoes_a_analisar": inscricoes_pendentes,
        "bolsistas_ativos": vinculos_ativos.count(),
        "atencao": {
            "inscricoes": inscricoes_pendentes,
            "recursos": Recurso.objects.filter(
                status=StatusRecurso.PENDENTE,
                inscricao__bolsa__status__in=STATUS_BOLSA_EM_SELECAO,
                inscricao__bolsa__projeto__coordenador_projeto__usuario=usuario,
            ).count(),
            "convites": contadores["convites"],
            "relatorios": contadores["finalizacao"],
            "vigencias_encerradas": _vigencias_encerradas(bolsas, hoje).count(),
            "prontas_para_finalizar": len(prontas),
        },
        "frequencias_a_lancar": _frequencias_do_mes_anterior(vinculos_ativos, hoje),
        "agenda": _agenda_de_avaliacoes(bolsas),
    }


def painel_do_admin(hoje=None):
    """Indicadores e "requer atenção" do início do administrador, no sistema todo; somam-se
    ao funil, às pendências e à atividade recente do painel já existente."""
    hoje = hoje or timezone.localdate()
    editais = Edital.objects.values_list("status").annotate(total=Count("id"))
    editais_por_status = dict(editais.values_list("status", "total"))
    bolsas_por_status = dict(
        Bolsa.objects.values_list("status")
        .annotate(total=Count("id"))
        .values_list("status", "total")
    )
    vinculos_ativos = vinculos_vigentes()
    usuarios = Usuario.objects.exclude(is_superuser=True)

    return {
        "editais_rascunho": editais_por_status.get(Edital.Status.RASCUNHO, 0),
        "bolsas_ativas": sum(bolsas_por_status.get(s, 0) for s in STATUS_BOLSA_EM_ANDAMENTO),
        "bolsas_aguardando_aprovacao": bolsas_por_status.get(StatusBolsa.SOLICITADA, 0),
        "bolsistas_ativos": vinculos_ativos.count(),
        "bolsistas_vinculo_direto": vinculos_ativos.filter(
            origem=OrigemVinculo.VINCULO_DIRETO
        ).count(),
        "usuarios_ativos": usuarios.filter(is_active=True).count(),
        "usuarios_inativos": usuarios.filter(is_active=False).count(),
        "desligamentos_pendentes": SolicitacaoDesligamento.objects.filter(
            status=StatusSolicitacaoDesligamento.PENDENTE
        ).count(),
        "frequencias_sem_lancamento": len(
            _frequencias_do_mes_anterior(vinculos_ativos, hoje)["bolsistas"]
        ),
    }


def _minha_bolsa(vinculo, hoje):
    """Bolsa ativa do aluno para o card "Minha bolsa", com a vigência já calculada."""
    if vinculo is None:
        return None
    bolsa = vinculo.bolsa
    inicio, fim = bolsa.inicio_vigencia, bolsa.fim_vigencia
    vigencia = None
    if inicio and fim:
        vigencia = {
            "inicio": inicio,
            "fim": fim,
            "dias_total": max(0, (fim - inicio).days),
            "dias_decorridos": max(0, (hoje - inicio).days),
            "dias_restantes": max(0, (fim - hoje).days),
        }
    return {
        "status": vinculo.status,
        "modalidade": bolsa.modalidade,
        "carga_horaria_semanal": bolsa.carga_horaria_semanal,
        "valor_mensal": bolsa.valor_mensal,
        "projeto_titulo": bolsa.projeto.titulo,
        "vigencia": vigencia,
    }


def painel_do_aluno(usuario, hoje=None):
    hoje = hoje or timezone.localdate()
    inscricoes = Inscricao.objects.filter(aluno=usuario).exclude(status=StatusInscricao.CANCELADA)
    vinculo = (
        vinculos_em_andamento()
        .filter(aluno=usuario)
        .select_related("bolsa__projeto", "bolsa__edital", "termo_compromisso")
        .first()
    )
    dados_bancarios = DadosBancarios.objects.filter(aluno__usuario=usuario).first()
    perfil = getattr(usuario, "perfil_aluno", None)

    return {
        "curso": perfil.curso if perfil else "",
        "bolsas_abertas": _bolsas_disponiveis_qs().count(),
        "inscricoes": inscricoes.count(),
        "convites_pendentes": ConviteVinculoDireto.objects.filter(
            aluno=usuario, status=StatusConvite.PENDENTE
        ).count(),
        "frequencias_cumpridas": (
            Frequencia.objects.filter(vinculo=vinculo, registrada=True).count() if vinculo else 0
        ),
        "minha_bolsa": _minha_bolsa(vinculo, hoje),
        "dados_bancarios_completos": bool(
            dados_bancarios and DadosBancariosSerializer().get_cadastro_completo(dados_bancarios)
        ),
        "inscricao_em_rascunho": inscricoes.filter(status=StatusInscricao.RASCUNHO).exists(),
        **_pendencias_do_termo(vinculo, perfil),
    }


def _pendencias_do_termo(vinculo, perfil):
    """O vínculo provisório só é efetivado com o termo: o aluno informa os dados adicionais e
    envia a parte assinada."""
    pendente = vinculo is not None and vinculo.status == StatusVinculo.AGUARDANDO_TERMO
    termo = getattr(vinculo, "termo_compromisso", None) if pendente else None
    return {
        "termo_pendente": pendente and not (termo and termo.aluno_assinou),
        "dados_termo_completos": not motivo_dados_termo_incompletos(perfil),
        "termo_motivo_recusa": termo.motivo_recusa_aluno if termo else "",
    }
