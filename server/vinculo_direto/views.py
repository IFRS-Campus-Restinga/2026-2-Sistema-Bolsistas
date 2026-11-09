from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAluno, IsCoordenadorProjeto
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import Bolsa, StatusBolsa
from bolsas.serializers import BolsaSerializer
from bolsistas.services import vincular_por_convite
from inscricoes.models import Documento, TipoDocumento
from notificacoes.services import Destino, Notificacao, coordenador_do_projeto

from .models import ConviteVinculoDireto, StatusConvite
from .regras import bolsa_elegivel_para_convite, vagas_livres
from .serializers import ConviteSerializer, DocumentoConviteSerializer, RejeitarConviteSerializer

DOCUMENTOS_OBRIGATORIOS = {TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.COMPROVANTE_MATRICULA}
MAX_DOCUMENTOS_ADICIONAIS = 5


def _convites_do_coordenador(usuario):
    return ConviteVinculoDireto.objects.filter(bolsa__projeto__coordenador_projeto__usuario=usuario)


def _garantir_editavel(convite):
    if convite.status not in (StatusConvite.EM_PREENCHIMENTO, StatusConvite.ENVIADO):
        raise ValidationError(
            {"detail": "Este convite não está disponível para edição de documentos."}
        )


class BolsasElegiveisView(generics.ListAPIView):
    serializer_class = BolsaSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        bolsas = Bolsa.objects.filter(
            projeto__coordenador_projeto__usuario=self.request.user
        ).select_related("projeto", "edital")
        return [bolsa for bolsa in bolsas if bolsa_elegivel_para_convite(bolsa)]


class BuscaAlunoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get(self, request):
        termo = request.query_params.get("q", "").strip()
        if len(termo) < 3:
            return Response([])
        alunos = Usuario.objects.filter(role=Usuario.Role.ALUNO).filter(
            Q(nome__icontains=termo) | Q(email__icontains=termo)
        )[:10]
        return Response(
            [
                {"id": aluno.id, "nome": aluno.nome or aluno.username, "email": aluno.email}
                for aluno in alunos
            ]
        )


class ConviteListCreateView(generics.ListCreateAPIView):
    serializer_class = ConviteSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        return (
            _convites_do_coordenador(self.request.user)
            .select_related("bolsa__projeto", "bolsa__edital", "aluno")
            .prefetch_related("documentos")
        )

    def perform_create(self, serializer):
        convite = serializer.save(
            coordenador_solicitante=self.request.user, status=StatusConvite.PENDENTE
        )
        Notificacao.para(convite.aluno).info().titulo("Novo convite de bolsa").mensagem(
            f"{self.request.user.nome} convidou você para a bolsa do projeto "
            f'"{convite.bolsa.projeto.titulo}".'
        ).destino(Destino.ALUNO_CONVITES).enviar()


class ConviteCoordenadorDetailView(generics.RetrieveAPIView):
    serializer_class = ConviteSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        return (
            _convites_do_coordenador(self.request.user)
            .select_related("bolsa__projeto", "bolsa__edital", "aluno")
            .prefetch_related("documentos")
        )


class CancelarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            _convites_do_coordenador(request.user).select_for_update(), pk=pk
        )
        if convite.status != StatusConvite.PENDENTE:
            raise ValidationError(
                {"detail": "Só é possível cancelar um convite enquanto aguarda resposta do aluno."}
            )
        convite.delete()
        return Response(status=204)


class AprovarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            _convites_do_coordenador(request.user).select_for_update(), pk=pk
        )
        if convite.status != StatusConvite.ENVIADO:
            raise ValidationError(
                {"detail": "Somente convites com documentação enviada podem ser aprovados."}
            )

        enviados = set(convite.documentos.values_list("tipo", flat=True))
        if not DOCUMENTOS_OBRIGATORIOS.issubset(enviados):
            raise ValidationError(
                {"detail": "Não é possível aprovar: faltam documentos obrigatórios."}
            )

        convite.status = StatusConvite.APROVADO
        convite.responsavel_decisao = request.user
        convite.data_decisao = timezone.now()
        convite.save(update_fields=["status", "responsavel_decisao", "data_decisao"])
        vincular_por_convite(convite)

        bolsa = convite.bolsa
        if vagas_livres(bolsa) <= 0 and bolsa.status != StatusBolsa.PREENCHIDA:
            bolsa.status = StatusBolsa.PREENCHIDA
            bolsa.save(update_fields=["status"])

        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.VINCULO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=bolsa.pk,
            descricao=(
                f"{convite.aluno.nome} vinculado(a) como bolsista da bolsa do projeto "
                f'"{bolsa.projeto.titulo}" por vínculo direto.'
            ),
        )

        Notificacao.para(convite.aluno).sucesso().titulo("Convite aprovado").mensagem(
            f'Sua documentação foi aprovada e você é bolsista do projeto "{bolsa.projeto.titulo}".'
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
        Notificacao.para(bolsa.coordenador_area).info().titulo("Vínculo direto efetivado").mensagem(
            f'Um vínculo direto foi efetivado na bolsa do projeto "{bolsa.projeto.titulo}" '
            f"(edital {bolsa.edital.nome})."
        ).destino(Destino.AREA_SOLICITACOES).enviar()

        return Response(ConviteSerializer(convite, context={"request": request}).data)


class RejeitarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            _convites_do_coordenador(request.user).select_for_update(), pk=pk
        )
        if convite.status != StatusConvite.ENVIADO:
            raise ValidationError(
                {"detail": "Somente convites com documentação enviada podem ser rejeitados."}
            )

        serializer = RejeitarConviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        convite.justificativa_rejeicao = dados["justificativa"]
        convite.responsavel_decisao = request.user
        convite.data_decisao = timezone.now()
        convite.status = (
            StatusConvite.REJEITADO if dados["definitivo"] else StatusConvite.EM_PREENCHIMENTO
        )
        convite.save(
            update_fields=[
                "status",
                "justificativa_rejeicao",
                "responsavel_decisao",
                "data_decisao",
            ]
        )
        projeto = convite.bolsa.projeto.titulo
        if dados["definitivo"]:
            aviso = Notificacao.para(convite.aluno).erro().titulo("Convite rejeitado")
            texto = f'Sua documentação para a bolsa do projeto "{projeto}" foi rejeitada.'
        else:
            aviso = Notificacao.para(convite.aluno).aviso().titulo("Documentação devolvida")
            texto = f'Ajuste a documentação do convite para a bolsa do projeto "{projeto}".'
        aviso.mensagem(f"{texto} Justificativa: {convite.justificativa_rejeicao}").destino(
            Destino.ALUNO_CONVITES
        ).enviar()
        return Response(ConviteSerializer(convite, context={"request": request}).data)


class MeusConvitesView(generics.ListAPIView):
    serializer_class = ConviteSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return (
            ConviteVinculoDireto.objects.filter(aluno=self.request.user)
            .select_related("bolsa__projeto", "bolsa__edital")
            .prefetch_related("documentos")
        )


class ConviteDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ConviteSerializer
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return (
            ConviteVinculoDireto.objects.filter(aluno=self.request.user)
            .select_related("bolsa__projeto", "bolsa__edital")
            .prefetch_related("documentos")
        )

    @transaction.atomic
    def perform_update(self, serializer):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(),
            pk=serializer.instance.pk,
            aluno=self.request.user,
        )
        _garantir_editavel(convite)
        serializer.instance = convite
        serializer.save()


def _notificar_resposta(convite, aceito):
    bolsa = convite.bolsa
    aviso = Notificacao.para(coordenador_do_projeto(bolsa))
    aviso = aviso.sucesso() if aceito else aviso.aviso()
    aviso.titulo("Convite aceito" if aceito else "Convite recusado").mensagem(
        f"{convite.aluno.nome} {'aceitou' if aceito else 'recusou'} o convite para a bolsa do "
        f'projeto "{bolsa.projeto.titulo}".'
    ).destino(Destino.PROJETO_CONVITES).enviar()


class AceitarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(), pk=pk, aluno=request.user
        )
        if convite.status != StatusConvite.PENDENTE:
            raise ValidationError({"detail": "Este convite já foi respondido."})
        convite.status = StatusConvite.EM_PREENCHIMENTO
        convite.data_resposta_aluno = timezone.now()
        convite.save(update_fields=["status", "data_resposta_aluno"])
        _notificar_resposta(convite, aceito=True)
        return Response(ConviteSerializer(convite, context={"request": request}).data)


class RecusarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(), pk=pk, aluno=request.user
        )
        if convite.status != StatusConvite.PENDENTE:
            raise ValidationError({"detail": "Este convite já foi respondido."})
        convite.status = StatusConvite.RECUSADO
        convite.data_resposta_aluno = timezone.now()
        convite.save(update_fields=["status", "data_resposta_aluno"])
        _notificar_resposta(convite, aceito=False)
        return Response(ConviteSerializer(convite, context={"request": request}).data)


class EnviarConviteView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(), pk=pk, aluno=request.user
        )
        _garantir_editavel(convite)

        if not convite.termos_aceitos:
            raise ValidationError(
                {"detail": "É preciso aceitar os termos do edital antes de enviar."}
            )

        tipos_enviados = set(convite.documentos.values_list("tipo", flat=True))
        faltando = DOCUMENTOS_OBRIGATORIOS - tipos_enviados
        if faltando:
            nomes = ", ".join(TipoDocumento(t).label for t in faltando)
            raise ValidationError({"detail": f"Documentos obrigatórios pendentes: {nomes}."})

        convite.status = StatusConvite.ENVIADO
        convite.data_envio_documentos = timezone.now()
        convite.save(update_fields=["status", "data_envio_documentos"])
        bolsa = convite.bolsa
        Notificacao.para(coordenador_do_projeto(bolsa)).info().titulo(
            "Documentação do convite enviada"
        ).mensagem(
            f"{convite.aluno.nome} enviou a documentação do convite para a bolsa do projeto "
            f'"{bolsa.projeto.titulo}". Analise para aprovar ou rejeitar.'
        ).destino(Destino.PROJETO_CONVITES).enviar()
        return Response(ConviteSerializer(convite, context={"request": request}).data)


class DocumentoConviteListCreateView(generics.ListCreateAPIView):
    serializer_class = DocumentoConviteSerializer
    permission_classes = [IsAuthenticated, IsAluno]
    parser_classes = [MultiPartParser, FormParser]

    def _convite(self):
        return get_object_or_404(
            ConviteVinculoDireto, pk=self.kwargs["convite_pk"], aluno=self.request.user
        )

    def get_queryset(self):
        return Documento.objects.filter(convite=self._convite())

    @transaction.atomic
    def perform_create(self, serializer):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(),
            pk=self.kwargs["convite_pk"],
            aluno=self.request.user,
        )
        _garantir_editavel(convite)

        tipo = serializer.validated_data.get("tipo")
        if tipo == TipoDocumento.ADICIONAL:
            qtd_adicionais = convite.documentos.filter(tipo=TipoDocumento.ADICIONAL).count()
            if qtd_adicionais >= MAX_DOCUMENTOS_ADICIONAIS:
                raise ValidationError(
                    {
                        "detail": f"No máximo {MAX_DOCUMENTOS_ADICIONAIS} documentos "
                        "adicionais por convite."
                    }
                )
        elif convite.documentos.filter(tipo=tipo).exists():
            raise ValidationError(
                {"tipo": ["Já existe um documento desse tipo para este convite."]}
            )

        arquivo = serializer.validated_data["arquivo"]
        serializer.save(convite=convite, nome_original=arquivo.name)


class DocumentoConviteDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def get_queryset(self):
        return Documento.objects.filter(convite__aluno=self.request.user)

    @transaction.atomic
    def perform_destroy(self, instance):
        convite = get_object_or_404(
            ConviteVinculoDireto.objects.select_for_update(),
            pk=instance.convite_id,
            aluno=self.request.user,
        )
        _garantir_editavel(convite)
        instance.delete()


class DocumentoConviteArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        documentos = Documento.objects.filter(convite__isnull=False)
        if request.user.role == Usuario.Role.ALUNO:
            documentos = documentos.filter(convite__aluno=request.user)
        else:
            documentos = documentos.filter(convite__in=_convites_do_coordenador(request.user))
        documento = get_object_or_404(documentos, pk=pk)
        try:
            arquivo = documento.arquivo.open("rb")
        except (FileNotFoundError, OSError):
            raise Http404("Arquivo não encontrado.") from None
        return FileResponse(
            arquivo, as_attachment=True, filename=documento.nome_original or "documento"
        )
