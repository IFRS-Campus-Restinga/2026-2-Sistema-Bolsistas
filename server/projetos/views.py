from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsCoordenadorProjeto

from .models import Projeto, StatusProjeto
from .serializers import ProjetoSerializer

BOLSA_STATUS_BLOQUEIAM_DESLIGAMENTO = ["ABERTA", "EM_SELECAO", "PREENCHIDA"]


class ProjetoListCreateView(generics.ListCreateAPIView):
    serializer_class = ProjetoSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsCoordenadorProjeto()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Projeto.objects.select_related("coordenador_projeto__usuario")
        if self.request.user.role == Usuario.Role.COORDENADOR_PROJETO:
            return queryset.filter(coordenador_projeto__usuario=self.request.user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(coordenador_projeto=self.request.user.perfil_coordenador_projeto)


class ProjetoDetailView(generics.RetrieveAPIView):
    serializer_class = ProjetoSerializer

    def get_queryset(self):
        queryset = Projeto.objects.select_related("coordenador_projeto__usuario")
        if self.request.user.role == Usuario.Role.COORDENADOR_PROJETO:
            return queryset.filter(coordenador_projeto__usuario=self.request.user)
        return queryset


class DesligarProjetoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        projeto = get_object_or_404(Projeto.objects.select_for_update(), pk=pk)

        if projeto.coordenador_projeto.usuario_id != request.user.id:
            raise PermissionDenied("Você não é o coordenador deste projeto.")

        status_bloqueantes = list(
            projeto.bolsas.filter(status__in=BOLSA_STATUS_BLOQUEIAM_DESLIGAMENTO)
            .values_list("status", flat=True)
            .distinct()
        )
        if status_bloqueantes:
            raise ValidationError(
                {
                    "detail": "Só é possível desligar o projeto quando nenhuma bolsa estiver "
                    "Aberta, Em Seleção ou Preenchida.",
                    "status_bloqueantes": status_bloqueantes,
                }
            )

        projeto.status = StatusProjeto.DESLIGADO
        projeto.save(update_fields=["status"])

        return Response(ProjetoSerializer(projeto).data)
