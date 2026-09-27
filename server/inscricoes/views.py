from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAluno

from .models import Documento, Inscricao, StatusInscricao, TipoDocumento
from .serializers import DocumentoSerializer, InscricaoSerializer

DOCUMENTOS_OBRIGATORIOS = {TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA}
MAX_DOCUMENTOS_ADICIONAIS = 5


def _garantir_editavel(inscricao):
    if inscricao.status == StatusInscricao.CANCELADA:
        raise ValidationError({"detail": "Esta inscrição foi cancelada."})

    hoje = timezone.localdate()
    if hoje > inscricao.bolsa.edital.data_fechamento_inscricoes:
        raise ValidationError({"detail": "O prazo de inscrição deste edital já foi encerrado."})


class InscricaoListCreateView(generics.ListCreateAPIView):
    serializer_class = InscricaoSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return Inscricao.objects.select_related("bolsa__projeto", "bolsa__edital").filter(
            aluno=self.request.user
        )

    def perform_create(self, serializer):
        serializer.save(aluno=self.request.user, status=StatusInscricao.RASCUNHO)


class InscricaoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InscricaoSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return Inscricao.objects.select_related("bolsa__projeto", "bolsa__edital").filter(
            aluno=self.request.user
        )

    def perform_update(self, serializer):
        _garantir_editavel(self.get_object())
        serializer.save()

    def perform_destroy(self, instance):
        if instance.status != StatusInscricao.RASCUNHO:
            raise ValidationError(
                {"detail": "Só é possível excluir uma inscrição enquanto ela é um rascunho."}
            )
        instance.delete()


class EnviarInscricaoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(), pk=pk, aluno=request.user
        )

        if inscricao.status != StatusInscricao.RASCUNHO:
            raise ValidationError(
                {"detail": "Só é possível enviar uma inscrição que está em rascunho."}
            )

        _garantir_editavel(inscricao)

        if not inscricao.termos_aceitos:
            raise ValidationError(
                {"detail": "É preciso aceitar os termos do edital antes de enviar."}
            )

        tipos_enviados = set(inscricao.documentos.values_list("tipo", flat=True))
        faltando = DOCUMENTOS_OBRIGATORIOS - tipos_enviados
        if faltando:
            nomes = ", ".join(TipoDocumento(t).label for t in faltando)
            raise ValidationError({"detail": f"Documentos obrigatórios pendentes: {nomes}."})

        inscricao.status = StatusInscricao.PENDENTE
        inscricao.data_envio = timezone.now()
        inscricao.save(update_fields=["status", "data_envio"])

        return Response(InscricaoSerializer(inscricao, context={"request": request}).data)


class CancelarInscricaoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(), pk=pk, aluno=request.user
        )

        if inscricao.status != StatusInscricao.PENDENTE:
            raise ValidationError({"detail": 'Só é possível cancelar uma inscrição "Pendente".'})

        if timezone.localdate() > inscricao.bolsa.edital.data_fechamento_inscricoes:
            raise ValidationError({"detail": "O prazo de inscrição deste edital já foi encerrado."})

        inscricao.status = StatusInscricao.CANCELADA
        inscricao.data_cancelamento = timezone.now()
        inscricao.save(update_fields=["status", "data_cancelamento"])

        return Response(InscricaoSerializer(inscricao, context={"request": request}).data)


class DocumentoListCreateView(generics.ListCreateAPIView):
    serializer_class = DocumentoSerializer
    permission_classes = [IsAuthenticated, IsAluno]
    parser_classes = [MultiPartParser, FormParser]

    def _inscricao(self):
        return get_object_or_404(Inscricao, pk=self.kwargs["inscricao_pk"], aluno=self.request.user)

    def get_queryset(self):
        return Documento.objects.filter(inscricao=self._inscricao())

    def perform_create(self, serializer):
        inscricao = self._inscricao()
        _garantir_editavel(inscricao)

        tipo = serializer.validated_data.get("tipo")
        if tipo == TipoDocumento.ADICIONAL:
            qtd_adicionais = inscricao.documentos.filter(tipo=TipoDocumento.ADICIONAL).count()
            if qtd_adicionais >= MAX_DOCUMENTOS_ADICIONAIS:
                raise ValidationError(
                    {
                        "detail": f"No máximo {MAX_DOCUMENTOS_ADICIONAIS} documentos "
                        "adicionais por inscrição."
                    }
                )
        elif inscricao.documentos.filter(tipo=tipo).exists():
            raise ValidationError(
                {"tipo": ["Já existe um documento desse tipo para esta inscrição."]}
            )

        arquivo = serializer.validated_data["arquivo"]
        serializer.save(inscricao=inscricao, nome_original=arquivo.name)


class DocumentoDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return Documento.objects.filter(inscricao__aluno=self.request.user)

    def perform_destroy(self, instance):
        _garantir_editavel(instance.inscricao)
        instance.delete()
