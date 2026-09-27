from datetime import date

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

from .models import Bolsa, EtapaAvaliacao, StatusBolsa, TipoBolsa
from .serializers import (
    BolsaEdicaoSerializer,
    BolsaSerializer,
    EtapaAvaliacaoSerializer,
)

STATUS_BLOQUEIAM_CANCELAMENTO = [
    StatusBolsa.CANCELADA,
    StatusBolsa.REJEITADA,
    StatusBolsa.ENCERRADA,
]


def _validar_data_maxima_preenchimento(bolsa):
    """Verifica se bolsa pode transicionar para PREENCHIDA dado o prazo do edital."""
    if (
        bolsa.edital.data_maxima_preenchimento_vagas
        and date.today() > bolsa.edital.data_maxima_preenchimento_vagas
    ):
        raise ValidationError(
            {
                "detail": f"Prazo máximo para preenchimento ({bolsa.edital.data_maxima_preenchimento_vagas.strftime('%d/%m/%Y')}) foi ultrapassado. "
                "Prorogue a data no cronograma do edital para continuar."
            }
        )


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
        queryset = Bolsa.objects.select_related("projeto", "edital").prefetch_related("etapas")

        if user.role == Usuario.Role.COORDENADOR_PROJETO:
            return queryset.filter(projeto__coordenador_projeto__usuario=user)

        if user.role == Usuario.Role.COORDENADOR_AREA:
            perfil = user.perfil_coordenador_area
            return queryset.filter(tipo__in=[perfil.tipo_area, TipoBolsa.INDISSOCIAVEL])

        return queryset.none()


def _bolsas_disponiveis_qs():
    hoje = timezone.localdate()
    return (
        Bolsa.objects.select_related("projeto", "edital")
        .prefetch_related("etapas")
        .filter(
            status=StatusBolsa.ABERTA,
            edital__data_abertura_inscricoes__lte=hoje,
            edital__data_fechamento_inscricoes__gte=hoje,
        )
    )


class BolsasDisponiveisView(generics.ListAPIView):
    serializer_class = BolsaSerializer

    def get_queryset(self):
        return _bolsas_disponiveis_qs()


class BolsaDisponivelDetailView(generics.RetrieveAPIView):
    serializer_class = BolsaSerializer

    def get_queryset(self):
        return _bolsas_disponiveis_qs()


class BolsaDetailView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "head", "options"]

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [IsAuthenticated(), IsCoordenadorProjeto()]
        return [IsAuthenticated(), (IsCoordenadorProjeto | IsCoordenadorArea)()]

    def get_serializer_class(self):
        if self.request.method == "PATCH":
            return BolsaEdicaoSerializer
        return BolsaSerializer

    def perform_update(self, serializer):
        motivo = serializer.instance.motivo_bloqueio_edicao()
        if motivo:
            raise ValidationError({"detail": motivo})
        serializer.save()

    def get_queryset(self):
        user = self.request.user
        queryset = Bolsa.objects.select_related("projeto", "edital").prefetch_related("etapas")

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

        _validar_data_maxima_preenchimento(bolsa)

        bolsa.status = StatusBolsa.ABERTA
        bolsa.coordenador_area = request.user.perfil_coordenador_area
        bolsa.data_decisao = timezone.now()
        bolsa.save(update_fields=["status", "coordenador_area", "data_decisao"])

        return Response(BolsaSerializer(bolsa, context={"request": request}).data)


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

        return Response(BolsaSerializer(bolsa, context={"request": request}).data)


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

        return Response(
            BolsaSerializer(bolsa, context={"request": request}).data, status=status.HTTP_200_OK
        )


class _EtapasDaBolsaMixin:
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_bolsa(self):
        if not hasattr(self, "_bolsa"):
            self._bolsa = get_object_or_404(
                Bolsa.objects.select_related("edital"),
                pk=self.kwargs["bolsa_pk"],
                projeto__coordenador_projeto__usuario=self.request.user,
            )
        return self._bolsa

    def garantir_editavel(self):
        motivo = self.get_bolsa().motivo_bloqueio_etapas()
        if motivo:
            raise ValidationError({"detail": motivo})

    def get_queryset(self):
        return EtapaAvaliacao.objects.filter(bolsa=self.get_bolsa())

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "bolsa": self.get_bolsa()}


class EtapaAvaliacaoListCreateView(_EtapasDaBolsaMixin, generics.ListCreateAPIView):
    serializer_class = EtapaAvaliacaoSerializer

    def perform_create(self, serializer):
        self.garantir_editavel()
        serializer.save(bolsa=self.get_bolsa())


class EtapaAvaliacaoDetailView(_EtapasDaBolsaMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = EtapaAvaliacaoSerializer
    http_method_names = ["get", "patch", "delete", "head", "options"]

    def perform_update(self, serializer):
        self.garantir_editavel()
        serializer.save()

    def perform_destroy(self, instance):
        self.garantir_editavel()
        instance.delete()
