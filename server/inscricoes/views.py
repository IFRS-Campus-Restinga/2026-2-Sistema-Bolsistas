from django.db import IntegrityError, transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAluno, IsCoordenadorProjeto
from bolsas.models import Bolsa, StatusBolsa
from bolsas.serializers import BolsaSerializer
from editais.models import Edital

from .models import (
    AnexoRecurso,
    Documento,
    EtapaRecurso,
    Inscricao,
    NotificacaoInscricao,
    Recurso,
    StatusInscricao,
    StatusRecurso,
    TipoDocumento,
)
from .serializers import (
    CandidatoDetalheSerializer,
    CandidatoSerializer,
    DocumentoSerializer,
    EnvioRecursoSerializer,
    IndeferimentoSerializer,
    InscricaoSerializer,
    JulgamentoRecursoSerializer,
    RecursoSerializer,
)

DOCUMENTOS_OBRIGATORIOS = {TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA}
MAX_DOCUMENTOS_ADICIONAIS = 5


def _garantir_editavel(inscricao):
    if inscricao.status == StatusInscricao.CANCELADA:
        raise ValidationError({"detail": "Esta inscrição foi cancelada."})

    if inscricao.status not in (StatusInscricao.RASCUNHO, StatusInscricao.PENDENTE):
        raise ValidationError({"detail": "Uma inscrição já analisada não pode ser alterada."})

    if inscricao.bolsa.edital.inscricoes_encerradas():
        raise ValidationError({"detail": "O prazo de inscrição deste edital já foi encerrado."})


class InscricaoListCreateView(generics.ListCreateAPIView):
    serializer_class = InscricaoSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return (
            Inscricao.objects.select_related("bolsa__projeto", "bolsa__edital")
            .prefetch_related("documentos", "notificacoes")
            .filter(aluno=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(aluno=self.request.user, status=StatusInscricao.RASCUNHO)


class InscricaoDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = InscricaoSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return (
            Inscricao.objects.select_related("bolsa__projeto", "bolsa__edital")
            .prefetch_related("documentos", "notificacoes")
            .filter(aluno=self.request.user)
        )

    @transaction.atomic
    def perform_update(self, serializer):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(),
            pk=serializer.instance.pk,
            aluno=self.request.user,
        )
        _garantir_editavel(inscricao)
        serializer.instance = inscricao
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

        if inscricao.bolsa.edital.inscricoes_encerradas():
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

    @transaction.atomic
    def perform_create(self, serializer):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(),
            pk=self.kwargs["inscricao_pk"],
            aluno=self.request.user,
        )
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

    @transaction.atomic
    def perform_destroy(self, instance):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(), pk=instance.inscricao_id, aluno=self.request.user
        )
        _garantir_editavel(inscricao)
        instance.delete()


class CandidatoListView(generics.ListAPIView):
    serializer_class = CandidatoSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        bolsa = get_object_or_404(
            Bolsa,
            pk=self.kwargs["bolsa_pk"],
            projeto__coordenador_projeto__usuario=self.request.user,
        )

        return (
            Inscricao.objects.filter(
                bolsa=bolsa,
                data_envio__isnull=False,
            )
            .exclude(
                status__in=[
                    StatusInscricao.RASCUNHO,
                    StatusInscricao.CANCELADA,
                ]
            )
            .select_related("aluno")
            .prefetch_related("documentos")
            .order_by("data_envio", "id")
        )


def _candidatos_do_coordenador(usuario):
    return Inscricao.objects.filter(
        bolsa__projeto__coordenador_projeto__usuario=usuario,
        data_envio__isnull=False,
    ).exclude(status__in=[StatusInscricao.RASCUNHO, StatusInscricao.CANCELADA])


class CandidatoDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    serializer_class = CandidatoDetalheSerializer

    def get_queryset(self):
        return (
            _candidatos_do_coordenador(self.request.user)
            .select_related("aluno")
            .prefetch_related("documentos")
        )


class DecisaoInscricaoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    decisao = None

    @transaction.atomic
    def post(self, request, pk):
        inscricao = get_object_or_404(
            Inscricao.objects.select_for_update(),
            pk=pk,
            bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        if inscricao.status != StatusInscricao.PENDENTE or not inscricao.data_envio:
            raise ValidationError(
                {"detail": "Somente inscrições enviadas e pendentes podem ser analisadas."}
            )
        if inscricao.bolsa.status not in (StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO):
            raise ValidationError({"detail": "Esta bolsa não está disponível para homologação."})
        if inscricao.bolsa.edital.status != Edital.Status.EM_VIGOR:
            raise ValidationError(
                {"detail": "O edital precisa estar em vigor para analisar inscrições."}
            )

        if not inscricao.bolsa.edital.inscricoes_encerradas():
            raise ValidationError(
                {
                    "detail": "A homologação e o indeferimento só são permitidos após o encerramento das inscrições."
                }
            )

        justificativa = ""
        if self.decisao == StatusInscricao.INDEFERIDA:
            serializer = IndeferimentoSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            justificativa = serializer.validated_data["justificativa"]
        else:
            enviados = set(inscricao.documentos.values_list("tipo", flat=True))
            if not DOCUMENTOS_OBRIGATORIOS.issubset(enviados):
                raise ValidationError(
                    {"detail": "Não é possível homologar: faltam documentos obrigatórios."}
                )

        inscricao.status = self.decisao
        inscricao.justificativa_indeferimento = justificativa
        inscricao.responsavel_decisao = request.user
        inscricao.data_decisao = timezone.now()
        inscricao.save(
            update_fields=[
                "status",
                "justificativa_indeferimento",
                "responsavel_decisao",
                "data_decisao",
            ]
        )
        mensagem = f'Sua inscrição no projeto "{inscricao.bolsa.projeto.titulo}" foi {inscricao.get_status_display().lower()}.'
        if justificativa:
            mensagem += f" Motivo: {justificativa}"
        NotificacaoInscricao.objects.create(inscricao=inscricao, mensagem=mensagem)
        return Response(CandidatoDetalheSerializer(inscricao, context={"request": request}).data)


class HomologarInscricaoView(DecisaoInscricaoView):
    decisao = StatusInscricao.HOMOLOGADA


class IndeferirInscricaoView(DecisaoInscricaoView):
    decisao = StatusInscricao.INDEFERIDA


class LerNotificacaoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def post(self, request, pk):
        notificacao = get_object_or_404(NotificacaoInscricao, pk=pk, inscricao__aluno=request.user)
        NotificacaoInscricao.objects.filter(pk=notificacao.pk, lida_em__isnull=True).update(
            lida_em=timezone.now()
        )
        return Response({"detail": "Notificação marcada como lida."})


class DocumentoArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        documentos = Documento.objects.all()
        if request.user.role == Usuario.Role.ALUNO:
            documentos = documentos.filter(inscricao__aluno=request.user)
        else:
            documentos = documentos.filter(inscricao__in=_candidatos_do_coordenador(request.user))
        documento = get_object_or_404(documentos, pk=pk)
        try:
            arquivo = documento.arquivo.open("rb")
        except (FileNotFoundError, OSError):
            raise Http404("Arquivo não encontrado.") from None
        return FileResponse(
            arquivo, as_attachment=True, filename=documento.nome_original or "documento"
        )


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
    if edital.recursos_homologacao_encerrados():
        return "O período de interpor recursos encerrou."
    if not edital.janela_recurso_homologacao_aberta():
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
            f"Seu recurso de homologação, na bolsa do projeto "
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


class RecursosListView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request):
        recursos = (
            Recurso.objects.filter(
                inscricao__in=inscricoes_acessiveis(request.user), etapa=EtapaRecurso.HOMOLOGACAO
            )
            .select_related(
                "inscricao__aluno", "inscricao__bolsa__projeto", "inscricao__bolsa__edital"
            )
            .prefetch_related("anexos")
        )
        return Response(RecursoSerializer(recursos, many=True, context={"request": request}).data)


class BolsaInscricaoDetailView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def get(self, request, pk):
        inscricao = get_object_or_404(
            Inscricao.objects.select_related("bolsa__projeto", "bolsa__edital").prefetch_related(
                "bolsa__etapas"
            ),
            pk=pk,
            aluno=request.user,
        )
        return Response(BolsaSerializer(inscricao.bolsa, context={"request": request}).data)
