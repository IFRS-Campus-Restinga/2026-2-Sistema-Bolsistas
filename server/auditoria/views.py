import csv

from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdministrador

from .models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from .serializers import LogAuditoriaSerializer


class PaginacaoAuditoria(PageNumberPagination):
    page_size = 20
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 100


def _opcoes(choices):
    return [{"valor": valor, "rotulo": rotulo} for valor, rotulo in choices.choices]


def _escolha_valida(request, parametro, choices):
    valor = request.query_params.get(parametro, "").strip()
    if valor and valor not in choices.values:
        raise ValidationError({parametro: f"Valor inválido: {valor}."})
    return valor


def _data(request, parametro, rotulo):
    texto = request.query_params.get(parametro)
    if not texto:
        return None
    data = parse_date(texto)
    if data is None:
        raise ValidationError({parametro: f"Informe a {rotulo} no formato AAAA-MM-DD."})
    return data


def _logs_filtrados(request):
    inicio = _data(request, "inicio", "data inicial")
    fim = _data(request, "fim", "data final")
    if inicio and fim and inicio > fim:
        raise ValidationError({"detail": "A data inicial não pode ser posterior à data final."})

    acao = _escolha_valida(request, "acao", AcaoAuditoria)
    entidade = _escolha_valida(request, "entidade", EntidadeAuditoria)
    usuario = request.query_params.get("usuario", "").strip()
    descricao = request.query_params.get("descricao", "").strip()

    logs = LogAuditoria.objects.all()
    if inicio:
        logs = logs.filter(data_hora__date__gte=inicio)
    if fim:
        logs = logs.filter(data_hora__date__lte=fim)
    if acao:
        logs = logs.filter(acao=acao)
    if entidade:
        logs = logs.filter(entidade=entidade)
    if usuario:
        logs = logs.filter(Q(usuario_nome__icontains=usuario) | Q(usuario_email__icontains=usuario))
    if descricao:
        logs = logs.filter(descricao__icontains=descricao)
    return logs


class LogAuditoriaListView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        paginador = PaginacaoAuditoria()
        pagina = paginador.paginate_queryset(_logs_filtrados(request), request, view=self)
        serializer = LogAuditoriaSerializer(pagina, many=True)
        return paginador.get_paginated_response(serializer.data)


class ExportarLogsView(APIView):
    """Mesmos filtros da listagem, sem paginação, em CSV pronto para o Excel."""

    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        logs = _logs_filtrados(request)
        hoje = timezone.localdate().isoformat()

        resposta = HttpResponse(content_type="text/csv; charset=utf-8")
        resposta["Content-Disposition"] = f'attachment; filename="auditoria-{hoje}.csv"'
        resposta.write("﻿")
        escritor = csv.writer(resposta, delimiter=";")
        escritor.writerow(
            ["Data e hora", "Ação", "Usuário", "E-mail", "Entidade", "ID", "Descrição"]
        )
        for log in logs:
            escritor.writerow(
                [
                    timezone.localtime(log.data_hora).strftime("%d/%m/%Y %H:%M:%S"),
                    log.get_acao_display(),
                    log.usuario_nome or "Sistema",
                    log.usuario_email,
                    log.get_entidade_display(),
                    log.entidade_id,
                    log.descricao,
                ]
            )
        return resposta


class OpcoesAuditoriaView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        return Response(
            {
                "acoes": _opcoes(AcaoAuditoria),
                "entidades": _opcoes(EntidadeAuditoria),
                "hoje": timezone.localdate().isoformat(),
            }
        )
