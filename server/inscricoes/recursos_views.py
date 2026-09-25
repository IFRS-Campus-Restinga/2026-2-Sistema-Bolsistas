from django.db import IntegrityError, transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAluno, IsCoordenadorProjeto
from bolsas.models import StatusBolsa
from editais.models import Edital

from .models import (
    AnexoRecurso,
    EtapaRecurso,
    Inscricao,
    NotificacaoInscricao,
    Recurso,
    StatusInscricao,
    StatusRecurso,
)
from .recursos_serializers import (
    EnvioRecursoSerializer,
    JulgamentoRecursoSerializer,
    RecursoSerializer,
)
from .serializers import CandidatoDetalheSerializer


def inscricoes_acessiveis(usuario):
    if usuario.role == Usuario.Role.ALUNO:
        return Inscricao.objects.filter(aluno=usuario)
    return Inscricao.objects.filter(
        bolsa__projeto__coordenador_projeto__usuario=usuario, data_envio__isnull=False
    ).exclude(status__in=[StatusInscricao.RASCUNHO, StatusInscricao.CANCELADA])


def motivo_bloqueio_recurso(inscricao):
    if inscricao.status != StatusInscricao.INDEFERIDA or not inscricao.data_envio:
        return "Somente inscrições enviadas e indeferidas podem receber recurso de homologação."
    edital = inscricao.bolsa.edital
    if edital.status != Edital.Status.EM_VIGOR or inscricao.bolsa.status not in [
        StatusBolsa.ABERTA,
        StatusBolsa.EM_SELECAO,
    ]:
        return "O edital ou a bolsa não está disponível para receber recursos."
    inicio = edital.data_recurso_homologacao_inicio
    fim = edital.data_recurso_homologacao_fim
    if not inicio or not fim or not inicio <= timezone.localdate() <= fim:
        return "O período de recursos da homologação não está aberto."
    if inscricao.recursos.filter(
        etapa=EtapaRecurso.HOMOLOGACAO, status=StatusRecurso.PENDENTE
    ).exists():
        return "Aguarde o julgamento do recurso pendente antes de enviar outro."
    return ""


def resposta_recursos(inscricao, request):
    bloqueio = motivo_bloqueio_recurso(inscricao)
    edital = inscricao.bolsa.edital
    return {
        "inscricao": CandidatoDetalheSerializer(inscricao, context={"request": request}).data,
        "recursos": RecursoSerializer(
            inscricao.recursos.filter(etapa=EtapaRecurso.HOMOLOGACAO).prefetch_related("anexos"),
            many=True,
            context={"request": request},
        ).data,
        "inicio": edital.data_recurso_homologacao_inicio,
        "fim": edital.data_recurso_homologacao_fim,
        "pode_enviar": not bloqueio and request.user.role == Usuario.Role.ALUNO,
        "motivo_bloqueio": bloqueio,
    }


class RecursosInscricaoView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        return (
            [IsAuthenticated(), IsAluno()]
            if self.request.method == "POST"
            else [IsAuthenticated(), (IsAluno | IsCoordenadorProjeto)()]
        )

    def get(self, request, inscricao_pk):
        inscricao = get_object_or_404(
            inscricoes_acessiveis(request.user)
            .select_related("aluno", "bolsa__edital")
            .prefetch_related("documentos"),
            pk=inscricao_pk,
        )
        return Response(resposta_recursos(inscricao, request))

    def post(self, request, inscricao_pk):
        arquivos_salvos = []
        try:
            with transaction.atomic():
                inscricao = get_object_or_404(
                    Inscricao.objects.select_for_update(), pk=inscricao_pk, aluno=request.user
                )
                bloqueio = motivo_bloqueio_recurso(inscricao)
                if bloqueio:
                    raise ValidationError({"detail": bloqueio})
                serializer = EnvioRecursoSerializer(
                    data={
                        "justificativa": request.data.get("justificativa"),
                        "anexos": request.FILES.getlist("anexos"),
                    }
                )
                serializer.is_valid(raise_exception=True)
                recurso = Recurso.objects.create(
                    inscricao=inscricao,
                    justificativa=serializer.validated_data["justificativa"],
                    motivo_contestado=inscricao.justificativa_indeferimento,
                )
                for arquivo in serializer.validated_data["anexos"]:
                    anexo = AnexoRecurso(recurso=recurso, nome_original=arquivo.name)
                    anexo.arquivo.save(arquivo.name, arquivo, save=False)
                    arquivos_salvos.append((anexo.arquivo.storage, anexo.arquivo.name))
                    anexo.save()
                resultado = resposta_recursos(inscricao, request)
            return Response(resultado, status=201)
        except Exception as exc:
            # Arquivos não participam do rollback da transação do banco.
            for storage, nome in arquivos_salvos:
                storage.delete(nome)
            if isinstance(exc, IntegrityError):
                raise ValidationError(
                    {"detail": "Já existe um recurso pendente para esta inscrição e etapa."}
                ) from exc
            raise


class JulgarRecursoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        referencia = get_object_or_404(
            Recurso, pk=pk, inscricao__bolsa__projeto__coordenador_projeto__usuario=request.user
        )
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(),
            pk=referencia.inscricao_id,
            bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        recurso = get_object_or_404(Recurso.objects.select_for_update(), pk=pk)
        if recurso.etapa != EtapaRecurso.HOMOLOGACAO or recurso.status != StatusRecurso.PENDENTE:
            raise ValidationError(
                {
                    "detail": "Somente recursos pendentes de homologação podem ser julgados nesta ação."
                }
            )
        if inscricao.status not in [StatusInscricao.INDEFERIDA, StatusInscricao.HOMOLOGADA]:
            raise ValidationError(
                {"detail": "Esta inscrição não está disponível para julgamento de recurso."}
            )
        if (
            inscricao.bolsa.edital.status != Edital.Status.EM_VIGOR
            or inscricao.bolsa.status not in [StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO]
        ):
            raise ValidationError(
                {"detail": "O edital ou a bolsa não está disponível para julgamento."}
            )
        serializer = JulgamentoRecursoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        agora = timezone.now()
        recurso.status = dados["decisao"]
        recurso.justificativa_julgamento = dados["justificativa"]
        recurso.responsavel_julgamento = request.user
        recurso.julgado_em = agora
        recurso.save(
            update_fields=[
                "status",
                "justificativa_julgamento",
                "responsavel_julgamento",
                "julgado_em",
            ]
        )
        if (
            recurso.status == StatusRecurso.DEFERIDO
            and inscricao.status != StatusInscricao.HOMOLOGADA
        ):
            inscricao.status = StatusInscricao.HOMOLOGADA
            inscricao.justificativa_indeferimento = ""
            inscricao.responsavel_decisao = request.user
            inscricao.data_decisao = agora
            inscricao.save(
                update_fields=[
                    "status",
                    "justificativa_indeferimento",
                    "responsavel_decisao",
                    "data_decisao",
                ]
            )
        mensagem = (
            f"Seu recurso #{recurso.pk} de homologação, na bolsa do projeto "
            f'"{inscricao.bolsa.projeto.titulo}", foi {recurso.get_status_display().lower()}.'
        )
        if recurso.justificativa_julgamento:
            mensagem += f" Justificativa: {recurso.justificativa_julgamento}"
        NotificacaoInscricao.objects.create(inscricao=inscricao, mensagem=mensagem)
        return Response(resposta_recursos(inscricao, request))


class AnexoRecursoArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        anexo = get_object_or_404(
            AnexoRecurso.objects.filter(recurso__inscricao__in=inscricoes_acessiveis(request.user)),
            pk=pk,
        )
        try:
            arquivo = anexo.arquivo.open("rb")
        except OSError:
            raise Http404("Arquivo não encontrado.") from None
        return FileResponse(arquivo, as_attachment=True, filename=anexo.nome_original)
