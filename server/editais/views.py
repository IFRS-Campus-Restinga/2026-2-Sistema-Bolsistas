from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCoordenadorArea, IsCoordenadorProjeto
from bolsas.models import EditalValorBolsa, StatusBolsa

from .models import Edital
from .serializers import (
    CronogramaEditalSerializer,
    EditalSerializer,
    ValoresBolsaEditalSerializer,
    representar_valores_bolsa,
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
            raise ValidationError({"detail": "Somente editais em rascunho podem ser publicados."})

        validar_cronograma({}, instance=edital, obrigatorio=True)

        if not edital.valores_bolsa.exists():
            raise ValidationError(
                {
                    "detail": "Defina as modalidades de bolsa e seus valores antes de "
                    "publicar o edital (em Editar, passo 2)."
                }
            )

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


class ValoresBolsaEditalView(APIView):
    """Modalidades + CH disponíveis no edital e o valor mensal de cada uma (US14)."""

    def get_permissions(self):
        if self.request.method == "PUT":
            return [IsAuthenticated(), IsCoordenadorArea()]
        return [IsAuthenticated(), (IsCoordenadorProjeto | IsCoordenadorArea)()]

    def get(self, request, pk):
        edital = get_object_or_404(Edital, pk=pk)
        return Response(representar_valores_bolsa(edital))

    @transaction.atomic
    def put(self, request, pk):
        edital = get_object_or_404(Edital.objects.select_for_update(), pk=pk)

        if edital.status in (Edital.Status.ENCERRADO, Edital.Status.ARQUIVADO):
            raise ValidationError(
                {"detail": "Editais encerrados ou arquivados não podem ser editados."}
            )

        serializer = ValoresBolsaEditalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        novos = {item["tipo"].id: item for item in serializer.validated_data["valores"]}

        bolsas_ativas = edital.bolsas.exclude(status__in=STATUS_BOLSA_FINALIZADOS)
        for atual in edital.valores_bolsa.select_related("tipo_bolsa_modalidade"):
            tipo = atual.tipo_bolsa_modalidade
            if tipo.id in novos:
                continue
            em_uso = bolsas_ativas.filter(
                modalidade=tipo.modalidade, carga_horaria_semanal=tipo.carga_horaria_semanal
            ).exists()
            if em_uso:
                raise ValidationError(
                    {
                        "detail": f"A combinação {tipo} não pode ser removida: há bolsas "
                        "deste edital usando essa modalidade e carga horária."
                    }
                )
            atual.delete()

        for item in novos.values():
            tipo = item["tipo"]
            EditalValorBolsa.objects.update_or_create(
                edital=edital,
                tipo_bolsa_modalidade=tipo,
                defaults={"valor_mensal": item["valor_mensal"]},
            )
            # O valor do edital vale para as bolsas ainda vigentes dessa combinação.
            bolsas_ativas.filter(
                modalidade=tipo.modalidade, carga_horaria_semanal=tipo.carga_horaria_semanal
            ).update(valor_mensal=item["valor_mensal"])

        return Response(representar_valores_bolsa(edital))
