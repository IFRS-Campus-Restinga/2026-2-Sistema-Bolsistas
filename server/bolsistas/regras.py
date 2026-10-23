from django.utils import timezone

from bolsas.models import StatusBolsa
from inscricoes.models import Recurso, StatusInscricao, StatusRecurso
from selecao.models import PublicacaoResultado
from vinculo_direto.models import STATUS_ATIVOS as STATUS_CONVITE_ATIVOS

from .models import RelatorioFinal, SituacaoRelatorio

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
    """Problema com o prazo de entrega do edital; usa a data do servidor."""
    prazo = vinculo.bolsa.edital.data_entrega_relatorios
    if prazo is None:
        return "O edital não define o prazo de entrega dos relatórios."
    if timezone.localdate() > prazo:
        return f"O prazo de entrega do relatório final terminou em {prazo:%d/%m/%Y}."
    return ""


def motivo_bloqueio_solicitacao(vinculo):
    """Por que o coordenador não pode solicitar o relatório agora; vazio quando pode."""
    if not bolsa_aceita_acompanhamento(vinculo.bolsa):
        return MOTIVO_BOLSA_ENCERRADA
    if relatorio_do_vinculo(vinculo):
        return "O relatório final já foi solicitado."
    return _motivo_prazo(vinculo)


def motivo_bloqueio_envio(vinculo):
    """Por que o aluno não pode enviar o relatório agora; vazio quando pode."""
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
    for vinculo in bolsa.vinculos.select_related("aluno", "relatorio_final"):
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


def motivo_bloqueio_finalizacao(bolsa):
    """Por que a bolsa ainda não pode ser finalizada; vazio quando pode."""
    if bolsa.status in STATUS_NAO_FINALIZAVEIS:
        return (
            f'Esta bolsa está com status "{bolsa.get_status_display()}" e não pode ser finalizada.'
        )

    if not bolsa.vinculos.exists():
        return "A bolsa não tem bolsistas vinculados."

    abertos = processos_em_aberto(bolsa)
    if abertos:
        return (
            "A bolsa ainda tem processos em aberto: "
            + ", ".join(abertos)
            + ". Conclua-os antes de finalizar."
        )

    pendentes = pendencias_para_finalizar(bolsa)
    if pendentes:
        return (
            "Todos os relatórios finais precisam estar aprovados. Pendentes: "
            + ", ".join(pendentes)
            + "."
        )

    return ""
