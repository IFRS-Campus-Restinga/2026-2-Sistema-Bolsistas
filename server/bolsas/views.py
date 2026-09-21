from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsCoordenadorArea, IsCoordenadorProjeto

from .models import Bolsa, StatusBolsa, TipoBolsa
from .serializers import BolsaSerializer

STATUS_BLOQUEIAM_CANCELAMENTO = [
    StatusBolsa.CANCELADA,
    StatusBolsa.REJEITADA,
    StatusBolsa.ENCERRADA,
]


def _area_permitida(bolsa, usuario):
    perfil = getattr(usuario, "perfil_coordenador_area", None)
    return perfil is not None and bolsa.tipo in (perfil.tipo_area, TipoBolsa.INDISSOCIAVEL)


class BolsaListCreateView(generics.ListCreateAPIView):
    serializer_class = BolsaSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsCoordenadorProjeto()]
        return [IsAuthenticated(), (IsCoordenadorProjeto | IsCoordenadorArea)()]

    def get_queryset(self):
        user = self.request.user
        queryset = Bolsa.objects.select_related("projeto", "edital")

        if user.role == Usuario.Role.COORDENADOR_PROJETO:
            return queryset.filter(projeto__coordenador_projeto__usuario=user)

        if user.role == Usuario.Role.COORDENADOR_AREA:
            perfil = user.perfil_coordenador_area
            return queryset.filter(tipo__in=[perfil.tipo_area, TipoBolsa.INDISSOCIAVEL])

        return queryset.none()


def _bolsas_disponiveis_qs():
    hoje = timezone.localdate()
    return Bolsa.objects.select_related("projeto", "edital").filter(
        status=StatusBolsa.ABERTA,
        edital__data_abertura_inscricoes__lte=hoje,
        edital__data_fechamento_inscricoes__gte=hoje,
    )


class BolsasDisponiveisView(generics.ListAPIView):
    serializer_class = BolsaSerializer

    def get_queryset(self):
        return _bolsas_disponiveis_qs()


class BolsaDisponivelDetailView(generics.RetrieveAPIView):
    """Detalhe de uma bolsa disponível — mesmo recorte do BolsasDisponiveisView,
    então não dá pra ver detalhe de bolsa fechada/fora do prazo adivinhando o id."""

    serializer_class = BolsaSerializer

    def get_queryset(self):
        return _bolsas_disponiveis_qs()


class BolsaDetailView(generics.RetrieveAPIView):
    serializer_class = BolsaSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto | IsCoordenadorArea]

    def get_queryset(self):
        user = self.request.user
        queryset = Bolsa.objects.select_related("projeto", "edital")

        if user.role == Usuario.Role.COORDENADOR_PROJETO:
            return queryset.filter(projeto__coordenador_projeto__usuario=user)

        if user.role == Usuario.Role.COORDENADOR_AREA:
            perfil = user.perfil_coordenador_area
            return queryset.filter(tipo__in=[perfil.tipo_area, TipoBolsa.INDISSOCIAVEL])

        return queryset.none()


class AprovarBolsaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    @transaction.atomic
    def post(self, request, pk):
        bolsa = get_object_or_404(Bolsa.objects.select_for_update(), pk=pk)

        if not _area_permitida(bolsa, request.user):
            raise PermissionDenied(
                "Esta bolsa pertence a outro tipo e não pode ser aprovada pelo seu perfil "
                "(bolsas Indissociáveis podem ser aprovadas por qualquer Coordenador de Área)."
            )

        if bolsa.status != StatusBolsa.SOLICITADA:
            raise ValidationError(
                {
                    "detail": f'Esta bolsa está com status "{bolsa.get_status_display()}" e só '
                    'pode ser aprovada enquanto estiver "Solicitada".'
                }
            )

        bolsa.status = StatusBolsa.ABERTA
        bolsa.coordenador_area = request.user.perfil_coordenador_area
        bolsa.data_decisao = timezone.now()
        bolsa.save(update_fields=["status", "coordenador_area", "data_decisao"])

        return Response(BolsaSerializer(bolsa).data)


class RejeitarBolsaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    @transaction.atomic
    def post(self, request, pk):
        bolsa = get_object_or_404(Bolsa.objects.select_for_update(), pk=pk)

        if not _area_permitida(bolsa, request.user):
            raise PermissionDenied(
                "Esta bolsa pertence a outro tipo e não pode ser rejeitada pelo seu perfil "
                "(bolsas Indissociáveis podem ser rejeitadas por qualquer Coordenador de Área)."
            )

        if bolsa.status != StatusBolsa.SOLICITADA:
            raise ValidationError(
                {
                    "detail": f'Esta bolsa está com status "{bolsa.get_status_display()}" e só '
                    'pode ser rejeitada enquanto estiver "Solicitada".'
                }
            )

        justificativa = (request.data.get("justificativa") or "").strip()
        if not justificativa:
            raise ValidationError({"justificativa": ["Informe a justificativa da rejeição."]})

        bolsa.status = StatusBolsa.REJEITADA
        bolsa.coordenador_area = request.user.perfil_coordenador_area
        bolsa.data_decisao = timezone.now()
        bolsa.justificativa_decisao = justificativa
        bolsa.save(
            update_fields=["status", "coordenador_area", "data_decisao", "justificativa_decisao"]
        )

        return Response(BolsaSerializer(bolsa).data)


class CancelarBolsaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        bolsa = get_object_or_404(Bolsa.objects.select_for_update(), pk=pk)

        if bolsa.projeto.coordenador_projeto.usuario_id != request.user.id:
            raise PermissionDenied("Você não é o coordenador desta bolsa.")

        if bolsa.status in STATUS_BLOQUEIAM_CANCELAMENTO:
            raise ValidationError(
                {"detail": f'Uma bolsa "{bolsa.get_status_display()}" não pode mais ser cancelada.'}
            )

        bolsa.status = StatusBolsa.CANCELADA
        bolsa.justificativa_decisao = (request.data.get("motivo") or "").strip()
        bolsa.save(update_fields=["status", "justificativa_decisao"])

        return Response(BolsaSerializer(bolsa).data, status=status.HTTP_200_OK)
