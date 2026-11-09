from django.db import transaction
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAdministrador, IsCoordenadorArea, IsCoordenadorProjeto
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import EditalValorBolsa, StatusBolsa, TipoBolsa

from .models import AlteracaoCronograma, Edital
from .serializers import (
    CAMPOS_CRONOGRAMA,
    AlteracaoCronogramaSerializer,
    CronogramaConsolidadoSerializer,
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

    def perform_create(self, serializer):
        edital = serializer.save()

        registrar_log(
            usuario=self.request.user,
            acao=AcaoAuditoria.CRIACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Edital "{edital.nome}" criado.',
        )


class EditalCronogramaUpdateView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = CronogramaEditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]

    def perform_update(self, serializer):
        edital = serializer.save()

        registrar_log(
            usuario=self.request.user,
            acao=AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Cronograma do edital "{edital.nome}" atualizado.',
        )


class EditalDetailView(generics.RetrieveUpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = EditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["get", "patch", "options"]

    def perform_update(self, serializer):
        edital = serializer.save()

        registrar_log(
            usuario=self.request.user,
            acao=AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Edital "{edital.nome}" atualizado.',
        )


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

        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.PUBLICACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Edital "{edital.nome}" publicado.',
        )

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

        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.ENCERRAMENTO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Edital "{edital.nome}" encerrado.',
        )

        return Response(EditalSerializer(edital).data)


def _filtro_bolsas_do_perfil(usuario):
    """Bolsas que cada tipo de coordenador acompanha; o administrador vê todas."""
    if usuario.role == Usuario.Role.COORDENADOR_AREA:
        area = usuario.perfil_coordenador_area.tipo_area
        return Q(bolsas__tipo__in=[area, TipoBolsa.INDISSOCIAVEL])
    if usuario.role == Usuario.Role.COORDENADOR_PROJETO:
        return Q(bolsas__projeto__coordenador_projeto__usuario=usuario)
    return Q()


class CronogramaConsolidadoView(APIView):
    """Todos os editais visíveis ao perfil, com as datas-chave do cronograma (US19).

    O coordenador de projeto só acompanha editais em vigor; coordenador de área e
    administrador veem todos. A contagem de bolsas segue o escopo de cada perfil.
    """

    permission_classes = [
        IsAuthenticated,
        IsCoordenadorArea | IsCoordenadorProjeto | IsAdministrador,
    ]

    def get(self, request):
        editais = Edital.objects.all()

        if request.user.role == Usuario.Role.COORDENADOR_PROJETO:
            editais = editais.filter(status=Edital.Status.EM_VIGOR)

        status_filtro = request.query_params.get("status", "").strip()
        if status_filtro:
            if status_filtro not in Edital.Status.values:
                raise ValidationError({"status": f"Valor inválido: {status_filtro}."})
            editais = editais.filter(status=status_filtro)

        editais = editais.annotate(
            total_bolsas=Count(
                "bolsas", filter=_filtro_bolsas_do_perfil(request.user), distinct=True
            ),
            total_alteracoes=Count("historico_cronograma", distinct=True),
        ).order_by("-id")

        return Response(CronogramaConsolidadoSerializer(editais, many=True).data)


class HistoricoCronogramaView(generics.ListAPIView):
    """Alterações de prazos do cronograma: data anterior, nova data, quem e quando (US20).

    Disponível só para administrador e coordenador de área. Filtros opcionais:
    ``edital`` (id) e ``campo`` (etapa do cronograma).
    """

    serializer_class = AlteracaoCronogramaSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea | IsAdministrador]

    def get_queryset(self):
        alteracoes = AlteracaoCronograma.objects.select_related("edital", "responsavel")

        edital = self.request.query_params.get("edital", "").strip()
        if edital:
            if not edital.isdigit():
                raise ValidationError({"edital": "Informe o id numérico do edital."})
            alteracoes = alteracoes.filter(edital_id=edital)

        campo = self.request.query_params.get("campo", "").strip()
        if campo:
            if campo not in CAMPOS_CRONOGRAMA:
                raise ValidationError({"campo": f"Valor inválido: {campo}."})
            alteracoes = alteracoes.filter(campo=campo)

        return alteracoes


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

        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.EDITAL,
            entidade_id=edital.pk,
            descricao=f'Valores de bolsa do edital "{edital.nome}" definidos.',
        )

        return Response(representar_valores_bolsa(edital))
