"""Views dos endpoints de auditoria."""

from auditlog.models import LogEntry
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from accounts.auditoria import editais_no_escopo, logs_visiveis_para
from accounts.models import Usuario
from accounts.permissions import IsAdministrador, IsCoordenadorArea
from editais.models import AlteracaoCronograma, Edital

from .serializers import AlteracaoCronogramaSerializer, LogEntrySerializer


class LogsPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100


class LogsAuditoriaView(ListAPIView):
    """
    GET /api/auditoria/logs/

    Lista paginada de logs de auditoria com filtros opcionais.

    Filtros via query string:
            - usuario    : ID (UUID) do usuário
      - data_inicio: YYYY-MM-DD
      - data_fim   : YYYY-MM-DD
      - modelo     : label do app.model (ex.: bolsas.bolsa)
      - acao       : CREATE / UPDATE / DELETE

    Escopo:
      - Administrador: vê tudo.
      - Coordenador de Área: vê apenas logs do seu escopo.
      - Demais: 403.
    """

    serializer_class = LogEntrySerializer
    pagination_class = LogsPagination
    permission_classes = [IsAuthenticated, (IsAdministrador | IsCoordenadorArea)]

    def get_queryset(self):
        usuario = self.request.user
        queryset = LogEntry.objects.select_related("actor", "content_type").order_by("-timestamp")

        queryset = logs_visiveis_para(usuario, queryset)

        # Filtros opcionais
        usuario_id = self.request.query_params.get("usuario") or self.request.query_params.get(
            "ator"
        )
        if usuario_id:
            queryset = queryset.filter(actor_id=usuario_id)

        data_inicio = self.request.query_params.get("data_inicio")
        if data_inicio:
            queryset = queryset.filter(timestamp__date__gte=data_inicio)

        data_fim = self.request.query_params.get("data_fim")
        if data_fim:
            queryset = queryset.filter(timestamp__date__lte=data_fim)

        modelo = self.request.query_params.get("modelo")
        if modelo:
            # Formato esperado: "app_label.model_name" (ex.: "bolsas.bolsa")
            partes = modelo.lower().split(".")
            if len(partes) == 2:
                queryset = queryset.filter(
                    content_type__app_label=partes[0],
                    content_type__model=partes[1],
                )

        acao = self.request.query_params.get("acao")
        if acao:
            mapa = {"CREATE": 0, "UPDATE": 1, "DELETE": 2, "ACCESS": 3}
            codigo_acao = mapa.get(acao.upper())
            if codigo_acao is not None:
                queryset = queryset.filter(action=codigo_acao)

        return queryset


class HistoricoCronogramaView(ListAPIView):
    """
    GET /api/auditoria/editais/<pk>/cronograma/

    Histórico completo de alterações de prazos de um edital.
    Critério de aceite literal da US20: data anterior, nova data, quem, quando.

    Escopo: Coordenador de Área vê apenas editais da sua área.
    """

    serializer_class = AlteracaoCronogramaSerializer
    permission_classes = [IsAuthenticated, (IsAdministrador | IsCoordenadorArea)]

    def get_queryset(self):
        usuario = self.request.user
        pk = self.kwargs["pk"]

        edital = get_object_or_404(Edital, pk=pk)

        # Verificar escopo para Coordenador de Área
        if usuario.role == Usuario.Role.COORDENADOR_AREA:
            if not editais_no_escopo(usuario).filter(pk=pk).exists():
                raise PermissionDenied(
                    "Você não tem permissão para consultar o histórico deste edital."
                )

        return (
            AlteracaoCronograma.objects.filter(edital=edital)
            .select_related("responsavel")
            .order_by("campo", "alterado_em")
        )
