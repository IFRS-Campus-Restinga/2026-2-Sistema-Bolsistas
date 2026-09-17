from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCoordenadorArea, IsCoordenadorProjeto

from .models import Edital
from .serializers import CronogramaEditalSerializer, EditalSerializer, validar_cronograma


class EditalListCreateView(generics.ListCreateAPIView):
    queryset = Edital.objects.order_by("-id")
    serializer_class = EditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea | IsCoordenadorProjeto]


class EditalCronogramaUpdateView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = CronogramaEditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]


class EditalDetailView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = EditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]


class PublicarEditalView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

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
            raise ValidationError("Somente editais em vigor podem ser encerrados.")

        edital.status = Edital.Status.ENCERRADO
        edital.save(update_fields=["status"])

        return Response(EditalSerializer(edital).data)
