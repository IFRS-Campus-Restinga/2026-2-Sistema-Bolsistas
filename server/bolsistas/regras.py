from django.db.models import Exists, OuterRef
from django.utils import timezone

from bolsas.models import Bolsa, StatusBolsa, fim_vigencia_efetivo
from inscricoes.models import Recurso, StatusInscricao, StatusRecurso
from selecao.models import PublicacaoResultado
from vinculo_direto.models import STATUS_ATIVOS as STATUS_CONVITE_ATIVOS

from .models import RelatorioFinal, SituacaoRelatorio, StatusVinculo, VinculoBolsista

STATUS_NAO_FINALIZAVEIS = [
    StatusBolsa.SOLICITADA,
    StatusBolsa.REJEITADA,
    StatusBolsa.CANCELADA,
    StatusBolsa.ENCERRADA,
]

MOTIVO_BOLSA_ENCERRADA = "A bolsa foi encerrada e não aceita mais ações de acompanhamento."


def bolsa_aceita_acompanhamento(bolsa):
    return bolsa.status != StatusBolsa.ENCERRADA


def relatorio_do_vinculo(vinculo):
    try:
        return vinculo.relatorio_final
    except RelatorioFinal.DoesNotExist:
        return None


def _motivo_prazo(vinculo):
    """O edital precisa definir o prazo de entrega. Passado o prazo, a solicitação e o
    envio continuam permitidos, mas o relatório fica marcado como entregue fora do prazo."""
    if vinculo.bolsa.edital.data_entrega_relatorios is None:
        return "O edital não define o prazo de entrega dos relatórios."
    return ""


def fora_do_prazo(edital):
    """O prazo de entrega dos relatórios do edital já passou; usa a data do servidor."""
    prazo = edital.data_entrega_relatorios
    return prazo is not None and timezone.localdate() > prazo


def motivo_bloqueio_solicitacao(vinculo):
    """Por que o coordenador não pode solicitar o relatório agora; vazio quando pode."""
    if vinculo.status == StatusVinculo.DESLIGADO:
        return "O vínculo deste bolsista foi desligado."
    if not bolsa_aceita_acompanhamento(vinculo.bolsa):
        return MOTIVO_BOLSA_ENCERRADA
    if relatorio_do_vinculo(vinculo):
        return "O relatório final já foi solicitado."
    return _motivo_prazo(vinculo)


def motivo_bloqueio_envio(vinculo):
    """Por que o aluno não pode enviar o relatório agora; vazio quando pode."""
    if vinculo.status == StatusVinculo.DESLIGADO:
        return "O vínculo desta bolsa foi desligado."
    if not bolsa_aceita_acompanhamento(vinculo.bolsa):
        return MOTIVO_BOLSA_ENCERRADA

    relatorio = relatorio_do_vinculo(vinculo)
    if relatorio is None:
        return "O coordenador do projeto ainda não solicitou o relatório final."
    if not relatorio.aceita_envio:
        return "O relatório final já foi aprovado."
    return _motivo_prazo(vinculo)


def pendencias_para_finalizar(bolsa):
    """Bolsistas sem relatório final aprovado, com a situação de cada um."""
    pendentes = []
    for vinculo in bolsa.vinculos.filter(status=StatusVinculo.ATIVO).select_related(
        "aluno", "relatorio_final"
    ):
        relatorio = relatorio_do_vinculo(vinculo)
        if relatorio is None:
            pendentes.append(f"{vinculo.aluno.nome} (não solicitado)")
        elif relatorio.situacao == SituacaoRelatorio.SOLICITADO:
            pendentes.append(f"{vinculo.aluno.nome} (não enviado)")
        elif relatorio.situacao != SituacaoRelatorio.APROVADO:
            pendentes.append(f"{vinculo.aluno.nome} ({relatorio.get_situacao_display().lower()})")
    return pendentes


def _quantidade(total, singular, plural):
    return f"{total} {singular if total == 1 else plural}"


def processos_em_aberto(bolsa):
    """O que ainda está em andamento na bolsa e impede encerrá-la.

    Rascunhos de inscrição não contam: só o aluno resolve, e um rascunho abandonado
    travaria a bolsa para sempre.
    """
    abertos = []

    pendentes = bolsa.inscricoes.filter(status=StatusInscricao.PENDENTE).count()
    if pendentes:
        abertos.append(
            _quantidade(
                pendentes,
                "inscrição aguardando homologação",
                "inscrições aguardando homologação",
            )
        )

    recursos = Recurso.objects.filter(inscricao__bolsa=bolsa, status=StatusRecurso.PENDENTE).count()
    if recursos:
        abertos.append(_quantidade(recursos, "recurso sem julgamento", "recursos sem julgamento"))

    convites = bolsa.convites_vinculo_direto.filter(status__in=STATUS_CONVITE_ATIVOS).count()
    if convites:
        abertos.append(
            _quantidade(
                convites,
                "convite de vínculo direto em andamento",
                "convites de vínculo direto em andamento",
            )
        )

    tem_homologados = bolsa.inscricoes.filter(status=StatusInscricao.HOMOLOGADA).exists()
    if tem_homologados and not PublicacaoResultado.objects.filter(bolsa=bolsa).exists():
        abertos.append("seleção sem resultado publicado")

    return abertos


def motivos_bloqueio_finalizacao(bolsa):
    """Tudo o que falta resolver para finalizar a bolsa, um item por pendência."""
    if bolsa.status in STATUS_NAO_FINALIZAVEIS:
        return [
            f'Esta bolsa está com status "{bolsa.get_status_display()}" e não pode ser finalizada.'
        ]
    if not bolsa.vinculos.filter(status=StatusVinculo.ATIVO).exists():
        return ["A bolsa não tem bolsistas vinculados."]

    motivos = [f"Processo em aberto: {processo}." for processo in processos_em_aberto(bolsa)]
    motivos += [f"Relatório final de {pendente}." for pendente in pendencias_para_finalizar(bolsa)]
    return motivos


def prazo_relatorio_encerrado(bolsa):
    """O prazo de entrega do edital passou; a bolsa fica vencida até ser finalizada."""
    return bolsa.status != StatusBolsa.ENCERRADA and fora_do_prazo(bolsa.edital)


def motivo_bloqueio_finalizacao(bolsa):
    """Por que a bolsa ainda não pode ser finalizada, em uma frase (para o endpoint); vazio
    quando pode. Usa a mesma regra da lista de `motivos_bloqueio_finalizacao`."""
    return " ".join(motivos_bloqueio_finalizacao(bolsa))


STATUS_BOLSA_EM_ANDAMENTO = [StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO, StatusBolsa.PREENCHIDA]


def _rotulo_bolsa(bolsa):
    return f'{bolsa.modalidade} {bolsa.carga_horaria_semanal}h do projeto "{bolsa.projeto.titulo}"'


def pendencias_do_coordenador(usuario):
    """O que o coordenador de projeto precisa resolver, em qualquer projeto dele, antes de
    solicitar uma nova bolsa; vazio quando pode solicitar."""
    hoje = timezone.localdate()
    pendencias = []

    bolsas = (
        Bolsa.objects.filter(
            projeto__coordenador_projeto__usuario=usuario,
            status__in=STATUS_BOLSA_EM_ANDAMENTO,
        )
        .select_related("projeto", "edital")
        .annotate(
            tem_bolsista_ativo=Exists(
                VinculoBolsista.objects.filter(bolsa=OuterRef("pk"), status=StatusVinculo.ATIVO)
            )
        )
        .order_by(fim_vigencia_efetivo(), "id")
    )
    for bolsa in bolsas:
        fim = bolsa.fim_vigencia
        prazo = bolsa.edital.data_entrega_relatorios
        if fim is not None and fim < hoje:
            pendencias.append(
                f"A bolsa {_rotulo_bolsa(bolsa)} venceu em {fim:%d/%m/%Y} e não foi finalizada."
            )
        elif prazo is not None and prazo < hoje and bolsa.tem_bolsista_ativo:
            # Combinado: passou o prazo do relatório, a bolsa fica vencida até ser finalizada.
            pendencias.append(
                f"O prazo dos relatórios finais da bolsa {_rotulo_bolsa(bolsa)} terminou em "
                f"{prazo:%d/%m/%Y} e a bolsa não foi finalizada."
            )

    sem_parecer = (
        RelatorioFinal.objects.filter(
            situacao=SituacaoRelatorio.AGUARDANDO_AVALIACAO,
            vinculo__status=StatusVinculo.ATIVO,
            vinculo__bolsa__projeto__coordenador_projeto__usuario=usuario,
        )
        .select_related("vinculo__aluno", "vinculo__bolsa__projeto")
        .order_by("enviado_em", "id")
    )
    for relatorio in sem_parecer:
        vinculo = relatorio.vinculo
        pendencias.append(
            f"O relatório final de {vinculo.aluno.nome} "
            f'(projeto "{vinculo.bolsa.projeto.titulo}") aguarda seu parecer.'
        )

    # TODO: termo de compromisso pendente entra quando a US53 (termo assinado) existir.
    return pendencias
