import calendar
from datetime import date

from django.utils import timezone

from bolsistas.regras import MOTIVO_BOLSA_ENCERRADA, bolsa_aceita_acompanhamento

from .models import StatusFrequencia, StatusPagamento


def primeiro_dia(data):
    return date(data.year, data.month, 1)


def proximo_mes(mes):
    return date(mes.year + 1, 1, 1) if mes.month == 12 else date(mes.year, mes.month + 1, 1)


def prazo_do_mes(edital, mes):
    """Último dia para lançar a frequência do mês: o dia-limite do edital no mês seguinte."""
    dia = edital.dia_limite_frequencia
    if not dia:
        return None
    seguinte = proximo_mes(mes)
    ultimo_dia = calendar.monthrange(seguinte.year, seguinte.month)[1]
    return date(seguinte.year, seguinte.month, min(dia, ultimo_dia))


def prazo_vencido(edital, mes, hoje=None):
    prazo = prazo_do_mes(edital, mes)
    return bool(prazo and (hoje or timezone.localdate()) > prazo)


def meses_do_vinculo(vinculo, hoje=None):
    """Meses em que o aluno foi bolsista, do ingresso (ou início da vigência) até hoje.

    O fim é o que vier primeiro entre hoje, o fim da vigência da bolsa e o desligamento.
    """
    hoje = hoje or timezone.localdate()
    bolsa = vinculo.bolsa

    inicio = timezone.localdate(vinculo.criado_em)
    if bolsa.data_inicio_vigencia and bolsa.data_inicio_vigencia > inicio:
        inicio = bolsa.data_inicio_vigencia

    fim = hoje
    if bolsa.data_fim_vigencia and bolsa.data_fim_vigencia < fim:
        fim = bolsa.data_fim_vigencia
    if vinculo.desligado_em and timezone.localdate(vinculo.desligado_em) < fim:
        fim = timezone.localdate(vinculo.desligado_em)

    meses = []
    mes = primeiro_dia(inicio)
    while mes <= fim:
        meses.append(mes)
        mes = proximo_mes(mes)
    return meses


def motivo_bloqueio_lancamento(vinculo, mes, frequencia=None, hoje=None):
    """Por que o coordenador não pode lançar a frequência deste mês; vazio quando pode."""
    if not bolsa_aceita_acompanhamento(vinculo.bolsa):
        return MOTIVO_BOLSA_ENCERRADA
    if mes not in meses_do_vinculo(vinculo, hoje):
        return f"{mes:%m/%Y} está fora do período deste bolsista na bolsa."
    if frequencia and frequencia.status_pagamento != StatusPagamento.PENDENTE:
        return "O pagamento deste mês já foi decidido; a frequência não pode mais ser alterada."
    return ""


def status_do_mes(frequencia):
    return frequencia.status if frequencia else StatusFrequencia.NAO_INFORMADO


def frequencia_pendente(vinculo, mes, frequencia, hoje=None):
    """Mês sem lançamento cujo prazo do edital já passou."""
    return frequencia is None and prazo_vencido(vinculo.bolsa.edital, mes, hoje)
