from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCoordenadorArea, IsCoordenadorProjeto
from bolsas.models import StatusBolsa

from .models import Edital
from .serializers import (
    CronogramaEditalSerializer,
    EditalDetalheSerializer,
    EditalSerializer,
    validar_cronograma,
)

STATUS_BOLSA_FINALIZADOS = {
    StatusBolsa.REJEITADA,
    StatusBolsa.ENCERRADA,
    StatusBolsa.CANCELADA,
}


class EditalListCreateView(generics.ListCreateAPIView):
    queryset = Edital.objects.order_by("-id")
    serializer_class = EditalSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsCoordenadorArea()]
        return [IsAuthenticated(), (IsCoordenadorProjeto | IsCoordenadorArea)()]


class EditalCronogramaUpdateView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.prefetch_related("historico_cronograma")
    serializer_class = CronogramaEditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]


class EditalDetailView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.prefetch_related("historico_cronograma").select_for_update()
    serializer_class = EditalDetalheSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]

    def get_queryset(self):
        if self.request.method == "PATCH":
            return Edital.objects.prefetch_related("historico_cronograma").select_for_update()
        return Edital.objects.prefetch_related("historico_cronograma")


class PublicarEditalView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    @transaction.atomic
    def post(self, request, pk):
        edital = get_object_or_404(
            Edital.objects.select_for_update(),
            pk=pk,
        )

        if edital.status != Edital.Status.RASCUNHO:
            raise ValidationError({"detail": "Somente editais em rascunho podem ser publicados."})

        validar_cronograma({}, instance=edital, obrigatorio=True)

        edital.status = Edital.Status.EM_VIGOR
        edital.save(update_fields=["status"])

        return Response(EditalSerializer(edital).data)


class EncerrarEditalView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    @transaction.atomic
    def post(self, request, pk):
        edital = get_object_or_404(
            Edital.objects.select_for_update(),
            pk=pk,
        )

        if edital.status != Edital.Status.EM_VIGOR:
            raise ValidationError({"detail": "Somente editais em vigor podem ser encerrados."})

        if edital.bolsas.exclude(status__in=STATUS_BOLSA_FINALIZADOS).exists():
            raise ValidationError(
                {
                    "detail": "Não é possível encerrar: há bolsas deste edital que ainda não "
                    "foram finalizadas (rejeitadas, encerradas ou canceladas)."
                }
            )

        edital.status = Edital.Status.ENCERRADO
        edital.save(update_fields=["status"])

        return Response(EditalSerializer(edital).data)
