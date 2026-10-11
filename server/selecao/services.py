from collections import defaultdict
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from bolsas.models import StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso

from .models import (
    DesempateClassificacao,
    DesistenciaVaga,
    IndicacaoBolsista,
    SituacaoClassificacao,
)

STATUS_BOLSA_EM_AVALIACAO = [StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO]


@dataclass(eq=False)
class Candidato:
    inscricao: Inscricao
    notas: dict
    nota_final: Decimal | None
    situacao: str | None = None
    posicao: int | None = None
    empate: bool = False
    empate_pendente: bool = False


@dataclass
class Classificacao:
    bolsa: object
    etapas: list
    pesos: dict
    candidatos: list

    def por_inscricao(self, inscricao_id):
        return next((c for c in self.candidatos if c.inscricao.id == inscricao_id), None)

    @property
    def incompletos(self):
        return [c for c in self.candidatos if c.nota_final is None]

    @property
    def tem_empate_pendente(self):
        return any(c.empate_pendente for c in self.candidatos)


def nome_aluno(usuario):
    return usuario.nome or usuario.get_full_name() or usuario.username


def resultado_publicado(bolsa):
    return getattr(bolsa, "publicacao_resultado", None)


def calcular_nota_final(notas, pesos):
    """Média ponderada pelas etapas da bolsa; None enquanto faltar nota em alguma etapa."""
    if not pesos or any(etapa_id not in notas for etapa_id in pesos):
        return None
    pesos = {etapa_id: peso or Decimal("0") for etapa_id, peso in pesos.items()}
    total = sum(pesos.values())
    if total <= 0:
        pesos = dict.fromkeys(pesos, Decimal("1"))
        total = Decimal(len(pesos))
    soma = sum(notas[etapa_id] * peso for etapa_id, peso in pesos.items())
    return (soma / total).quantize(Decimal("0.01"), ROUND_HALF_UP)


def motivo_bloqueio_notas(bolsa):
    if resultado_publicado(bolsa):
        return "O resultado desta bolsa já foi publicado; as notas não podem mais ser alteradas."
    if bolsa.status not in STATUS_BOLSA_EM_AVALIACAO:
        return f'Uma bolsa "{bolsa.get_status_display()}" não está em avaliação.'
    if bolsa.edital.status != Edital.Status.EM_VIGOR:
        return "O edital precisa estar em vigor para lançar notas."
    if not bolsa.edital.inscricoes_encerradas():
        return "As notas só podem ser lançadas após o encerramento das inscrições."
    if not bolsa.etapas.exists():
        return "Cadastre as etapas de avaliação da bolsa antes de lançar notas."
    return ""


def classificar(bolsa):
    etapas = list(bolsa.etapas.all())
    pesos = bolsa.pesos_efetivos_etapas()
    inscricoes = (
        bolsa.inscricoes.filter(status=StatusInscricao.HOMOLOGADA)
        .select_related("aluno")
        .prefetch_related("notas_etapas")
        .order_by("data_envio", "id")
    )
    desempates = dict(
        DesempateClassificacao.objects.filter(inscricao__bolsa=bolsa).values_list(
            "inscricao_id", "ordem"
        )
    )

    candidatos = []
    for inscricao in inscricoes:
        notas = {nota.etapa_id: nota.nota for nota in inscricao.notas_etapas.all()}
        candidatos.append(Candidato(inscricao, notas, calcular_nota_final(notas, pesos)))

    avaliados = [c for c in candidatos if c.nota_final is not None]
    nota_minima = bolsa.nota_minima
    classificados = [c for c in avaliados if nota_minima is None or c.nota_final >= nota_minima]
    desclassificados = [c for c in avaliados if c not in classificados]

    classificados.sort(
        key=lambda c: (
            -c.nota_final,
            desempates.get(c.inscricao.id, float("inf")),
            c.inscricao.data_envio or timezone.now(),
            c.inscricao.id,
        )
    )
    _marcar_empates(classificados, desempates)
    for posicao, candidato in enumerate(classificados, start=1):
        candidato.posicao = posicao

    # Titulares são sempre os N primeiros (N = vagas); os demais classificados são suplentes.
    vagas = bolsa.quantidade_vagas
    for candidato in classificados[:vagas]:
        candidato.situacao = SituacaoClassificacao.TITULAR
    for candidato in classificados[vagas:]:
        candidato.situacao = SituacaoClassificacao.SUPLENTE
    for candidato in desclassificados:
        candidato.situacao = SituacaoClassificacao.DESCLASSIFICADO

    desclassificados.sort(key=lambda c: -c.nota_final)
    incompletos = sorted(
        (c for c in candidatos if c.nota_final is None),
        key=lambda c: nome_aluno(c.inscricao.aluno).lower(),
    )
    return Classificacao(bolsa, etapas, pesos, classificados + desclassificados + incompletos)


def _marcar_empates(classificados, desempates):
    grupos = defaultdict(list)
    for candidato in classificados:
        grupos[candidato.nota_final].append(candidato)
    for grupo in grupos.values():
        if len(grupo) < 2:
            continue
        ordens = [desempates.get(c.inscricao.id) for c in grupo]
        pendente = None in ordens or len(set(ordens)) != len(ordens)
        for candidato in grupo:
            candidato.empate = True
            candidato.empate_pendente = pendente


def pendencias_publicacao(bolsa, classificacao):
    if resultado_publicado(bolsa):
        return ["O resultado desta bolsa já foi publicado."]

    pendencias = []
    bloqueio = motivo_bloqueio_notas(bolsa)
    if bloqueio:
        pendencias.append(bloqueio)

    if bolsa.inscricoes.filter(status=StatusInscricao.PENDENTE, data_envio__isnull=False).exists():
        pendencias.append("Há inscrições aguardando homologação.")
    if Recurso.objects.filter(inscricao__bolsa=bolsa, status=StatusRecurso.PENDENTE).exists():
        pendencias.append("Há recursos de homologação aguardando julgamento.")
    fim_recursos = bolsa.edital.data_recurso_homologacao_fim
    if fim_recursos and timezone.localdate() <= fim_recursos:
        pendencias.append(
            "O período de recursos da homologação vai até "
            f"{fim_recursos:%d/%m/%Y}; o resultado só pode ser publicado depois dele."
        )

    if not classificacao.candidatos:
        pendencias.append("Não há candidatos homologados para classificar.")
    if classificacao.incompletos:
        pendencias.append(
            f"{len(classificacao.incompletos)} candidato(s) ainda sem nota em todas as etapas."
        )
    if classificacao.tem_empate_pendente:
        pendencias.append(
            "Há candidatos empatados na mesma nota final; defina a ordem de desempate."
        )
    return pendencias


@dataclass
class SituacaoVagas:
    """Como estão as vagas de uma bolsa com resultado publicado."""

    vagas: int
    indicados: set
    desistentes: set
    disponiveis: list  # classificados ainda sem indicação e sem desistência, pela posição

    @property
    def vagas_livres(self):
        return max(self.vagas - len(self.indicados), 0)

    @property
    def titulares_pendentes(self):
        return [r for r in self.disponiveis if r.situacao == SituacaoClassificacao.TITULAR]

    @property
    def vagas_para_suplentes(self):
        return max(self.vagas_livres - len(self.titulares_pendentes), 0)


def situacao_vagas(bolsa):
    publicacao = resultado_publicado(bolsa)
    if not publicacao:
        return None
    indicados = set(
        IndicacaoBolsista.objects.filter(bolsa=bolsa).values_list("inscricao_id", flat=True)
    )
    desistentes = set(
        DesistenciaVaga.objects.filter(bolsa=bolsa).values_list("inscricao_id", flat=True)
    )
    disponiveis = [
        resultado
        for resultado in publicacao.resultados.exclude(
            situacao=SituacaoClassificacao.DESCLASSIFICADO
        )
        .select_related("inscricao")
        .order_by("posicao")
        if resultado.inscricao_id not in indicados
        and resultado.inscricao_id not in desistentes
        and resultado.inscricao.status == StatusInscricao.HOMOLOGADA
    ]
    return SituacaoVagas(bolsa.quantidade_vagas, indicados, desistentes, disponiveis)


def motivo_bloqueio_indicacao(resultado, vagas):
    if resultado.situacao == SituacaoClassificacao.DESCLASSIFICADO:
        return "Só é possível indicar candidatos classificados no resultado."
    if resultado.inscricao_id in vagas.indicados:
        return "Este candidato já foi indicado."
    if resultado.inscricao_id in vagas.desistentes:
        return "Este candidato não vai assumir a vaga."
    if resultado.inscricao.status != StatusInscricao.HOMOLOGADA:
        return "A inscrição deste candidato não está mais ativa."
    if vagas.vagas_livres == 0:
        return "Todas as vagas desta bolsa já foram preenchidas."
    if resultado.situacao == SituacaoClassificacao.SUPLENTE and vagas.vagas_para_suplentes == 0:
        return (
            "As vagas restantes são dos titulares. Registre que um titular não vai assumir "
            "para liberar a vaga a um suplente."
        )
    return ""


def exige_justificativa_indicacao(resultado, vagas):
    """Titulares entram direto; o 1º suplente disponível também. Pular a fila de
    suplentes exige justificativa, e o suplente pulado continua disponível."""
    if resultado.situacao != SituacaoClassificacao.SUPLENTE:
        return False
    return any(
        outro.situacao == SituacaoClassificacao.SUPLENTE and outro.posicao < resultado.posicao
        for outro in vagas.disponiveis
    )


def motivo_bloqueio_desistencia(resultado, vagas):
    if resultado.situacao != SituacaoClassificacao.TITULAR:
        return "Só é possível registrar que um titular não vai assumir a vaga."
    if resultado.inscricao_id in vagas.indicados:
        return "Este candidato já foi indicado como bolsista."
    if resultado.inscricao_id in vagas.desistentes:
        return "Já foi registrado que este candidato não vai assumir."
    return ""
