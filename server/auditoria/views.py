from django.db.models import Q
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdministrador

from .models import AcaoAuditoria, EntidadeAuditoria, LogAuditoria
from .serializers import LogAuditoriaSerializer


def _opcoes(choices):
    return [{"valor": valor, "rotulo": rotulo} for valor, rotulo in choices.choices]


def _escolha_valida(request, parametro, choices):
    valor = request.query_params.get(parametro, "").strip()
    if valor and valor not in choices.values:
        raise ValidationError({parametro: f"Valor inválido: {valor}."})
    return valor


class PaginacaoAuditoria(PageNumberPagination):
    page_size = 20
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 100


class LogAuditoriaListView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        inicio_texto = request.query_params.get("inicio")
        fim_texto = request.query_params.get("fim")

        inicio = parse_date(inicio_texto) if inicio_texto else None
        fim = parse_date(fim_texto) if fim_texto else None

        if inicio_texto and inicio is None:
            raise ValidationError({"inicio": "Informe a data inicial no formato AAAA-MM-DD."})

        if fim_texto and fim is None:
            raise ValidationError({"fim": "Informe a data final no formato AAAA-MM-DD."})

        if inicio and fim and inicio > fim:
            raise ValidationError({"detail": "A data inicial não pode ser posterior à data final."})

        acao = _escolha_valida(request, "acao", AcaoAuditoria)
        entidade = _escolha_valida(request, "entidade", EntidadeAuditoria)
        usuario = request.query_params.get("usuario", "").strip()
        descricao = request.query_params.get("descricao", "").strip()

        logs = LogAuditoria.objects.select_related("usuario")

        if acao:
            logs = logs.filter(acao=acao)

        if entidade:
            logs = logs.filter(entidade=entidade)

        if usuario:
            logs = logs.filter(
                Q(usuario__nome__icontains=usuario) | Q(usuario__email__icontains=usuario)
            )

        if descricao:
            logs = logs.filter(descricao__icontains=descricao)

        if inicio:
            logs = logs.filter(data_hora__date__gte=inicio)

        if fim:
            logs = logs.filter(data_hora__date__lte=fim)

        paginador = PaginacaoAuditoria()
        pagina = paginador.paginate_queryset(logs, request, view=self)
        serializer = LogAuditoriaSerializer(pagina, many=True)
        return paginador.get_paginated_response(serializer.data)


class OpcoesAuditoriaView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        return Response({"acoes": _opcoes(AcaoAuditoria), "entidades": _opcoes(EntidadeAuditoria)})
