from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.auditoria import editais_no_escopo, registrar_acao
from accounts.models import Usuario
from accounts.permissions import IsAdministrador, IsCoordenadorArea, IsCoordenadorProjeto
from bolsas.models import StatusBolsa

from .models import Edital
from .serializers import (
    CronogramaConsolidadoSerializer,
    CronogramaEditalSerializer,
    EditalDetalheSerializer,
    EditalSerializer,
    validar_cronograma,
)

# Bolsas ativas que serão cascata-canceladas ao encerrar o edital
STATUS_ATIVOS_BOLSA = [
    StatusBolsa.SOLICITADA,
    StatusBolsa.APROVADA,
    StatusBolsa.ABERTA,
    StatusBolsa.EM_SELECAO,
]


class EditalListCreateView(generics.ListCreateAPIView):
    queryset = Edital.objects.order_by("-id")
    serializer_class = EditalSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), (IsCoordenadorArea | IsAdministrador)()]
        return [
            IsAuthenticated(),
            (IsCoordenadorProjeto | IsCoordenadorArea | IsAdministrador)(),
        ]


class EditalCronogramaUpdateView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = CronogramaEditalSerializer
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]
    http_method_names = ["get", "patch", "options"]


class EditalDetailView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.prefetch_related("historico_cronograma").select_for_update()
    serializer_class = EditalDetalheSerializer
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]
    http_method_names = ["get", "patch", "options"]


class PublicarEditalView(APIView):
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]

    @transaction.atomic
    def post(self, request, pk):
        edital = get_object_or_404(
            Edital.objects.select_for_update(),
            pk=pk,
        )

        if edital.status != Edital.Status.RASCUNHO:
            raise ValidationError("Somente editais em rascunho podem ser publicados.")

        validar_cronograma({}, instance=edital, obrigatorio=True)

        edital.status = Edital.Status.EM_VIGOR
        edital.save(update_fields=["status"])

        registrar_acao(request.user, "Edital publicado", edital)

        return Response(EditalSerializer(edital).data)


class EncerrarEditalView(APIView):
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]

    @transaction.atomic
    def post(self, request, pk):
        edital = get_object_or_404(
            Edital.objects.select_for_update(),
            pk=pk,
        )

        if edital.status != Edital.Status.EM_VIGOR:
            raise ValidationError({"detail": "Somente editais em vigor podem ser encerrados."})

        # Bloquear apenas se houver bolsa com vaga preenchida/bolsista vinculado.
        # NOTA: nenhum endpoint seta PREENCHIDA hoje (fluxo de efetivação/VinculoBolsista
        # não está implementado), então esta regra é permissiva na prática até o fluxo existir.
        if edital.bolsas.filter(status=StatusBolsa.PREENCHIDA).exists():
            raise ValidationError(
                {
                    "detail": "Não é possível encerrar: há bolsa com vaga preenchida/bolsista vinculado. "
                    "Resolva a situação dos bolsistas ativos antes de encerrar."
                }
            )

        # Cascata: cancelar bolsas ainda ativas na mesma transação.
        # Iterar + save (não .update()) para que simple_history e auditlog registrem cada bolsa.
        bolsas_ativas = list(edital.bolsas.filter(status__in=STATUS_ATIVOS_BOLSA))
        for bolsa in bolsas_ativas:
            bolsa.status = StatusBolsa.CANCELADA
            bolsa.justificativa_decisao = "Cancelada automaticamente: edital encerrado."
            bolsa.save(update_fields=["status", "justificativa_decisao"])
            registrar_acao(
                request.user,
                "Bolsa cancelada automaticamente",
                bolsa,
                detalhe="Edital encerrado.",
            )

        edital.status = Edital.Status.ENCERRADO
        edital.save(update_fields=["status"])

        registrar_acao(request.user, "Edital encerrado", edital)

        return Response(EditalSerializer(edital).data)


class CronogramaConsolidadoView(generics.ListAPIView):
    """
    GET /api/editais/cronograma-consolidado/

    Lista editais do tipo do Coordenador de Área com datas-chave (US19).
        Escopo:
            - Administrador: vê editais de todas as áreas.
            - Coordenador de Área: bolsas do tipo da área (INDISSOCIAVEL incluído).
    Ordenação: por data de abertura de inscrições mais próxima.
    """

    serializer_class = CronogramaConsolidadoSerializer
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]

    def get_queryset(self):
        usuario = self.request.user

        if usuario.role == Usuario.Role.ADMINISTRADOR:
            return (
                Edital.objects.all()
                .distinct()
                .prefetch_related("bolsas")
                .order_by("data_abertura_inscricoes", "-id")
            )

        return (
            Edital.objects.filter(
                Q(id__in=editais_no_escopo(usuario).values("id")) | Q(bolsas__isnull=True)
            )
            .distinct()
            .prefetch_related("bolsas")
            .order_by("data_abertura_inscricoes", "-id")
        )


class ArquivarEditalView(APIView):
    permission_classes = [IsAuthenticated, (IsCoordenadorArea | IsAdministrador)]

    @transaction.atomic
    def post(self, request, pk):
        edital = get_object_or_404(
            Edital.objects.select_for_update(),
            pk=pk,
        )

        if edital.status == Edital.Status.RASCUNHO:
            raise ValidationError({"detail": "Somente editais encerrados podem ser finalizados."})

        # Estado final único: ENCERRADO.
        if edital.status != Edital.Status.ENCERRADO:
            edital.status = Edital.Status.ENCERRADO
            edital.save(update_fields=["status"])
            registrar_acao(request.user, "Edital encerrado", edital)

        return Response(EditalSerializer(edital).data)
