from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Count, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Aluno, Usuario
from accounts.permissions import IsAluno, IsCoordenadorArea, IsCoordenadorProjeto
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa

from .models import (
    CancelamentoVaga,
    OrigemDesligamento,
    RelatorioFinal,
    SituacaoRelatorio,
    SolicitacaoDesligamento,
    StatusSolicitacaoDesligamento,
    StatusVinculo,
    TermoCompromisso,
    VinculoBolsista,
)
from .regras import (
    MOTIVO_BOLSA_ENCERRADA,
    bolsa_aceita_acompanhamento,
    motivo_bloqueio_envio,
    motivo_bloqueio_solicitacao,
    relatorio_do_vinculo,
)
from .serializers import (
    BolsaParaFinalizarSerializer,
    CancelamentoVagaSerializer,
    DadosTermoAlunoSerializer,
    DecisaoDesligamentoSerializer,
    EnvioRelatorioSerializer,
    EnvioTermoAlunoSerializer,
    EnvioTermoFinalSerializer,
    MeuVinculoSerializer,
    MotivoDesligamentoSerializer,
    ParecerSerializer,
    RelatorioFinalSerializer,
    SolicitacaoDesligamentoSerializer,
    TermoCompromissoSerializer,
    VinculoDoCoordenadorSerializer,
)
from .services import atualizar_status_preenchimento, efetivar_desligamento
from .termos import calcular_idade, gerar_docx_termo


def _vinculo_do_coordenador(usuario, pk, travar=False):
    queryset = VinculoBolsista.objects.select_related(
        "aluno", "bolsa__projeto", "bolsa__coordenador_area__usuario"
    )
    if travar:
        queryset = queryset.select_for_update()
    return get_object_or_404(
        queryset,
        pk=pk,
        bolsa__projeto__coordenador_projeto__usuario=usuario,
    )


def _garantir_vinculo_ativo(vinculo):
    if vinculo.status != StatusVinculo.ATIVO:
        raise ValidationError({"detail": "Este vínculo já foi desligado."})
    if vinculo.solicitacoes_desligamento.filter(
        status=StatusSolicitacaoDesligamento.PENDENTE
    ).exists():
        raise ValidationError({"detail": "Já existe um pedido de desligamento pendente."})


class MeusVinculosView(generics.ListAPIView):
    """Bolsas em que o aluno logado é bolsista, com a situação do relatório final."""

    permission_classes = [IsAuthenticated, IsAluno]
    serializer_class = MeuVinculoSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            VinculoBolsista.objects.filter(aluno=self.request.user)
            .select_related(
                "bolsa__edital",
                "bolsa__projeto__coordenador_projeto__usuario",
                "relatorio_final",
                "termo_compromisso",
            )
            .order_by("-criado_em", "-id")
        )


class DadosTermoAlunoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def _perfil(self, request):
        perfil, _ = Aluno.objects.get_or_create(usuario=request.user)
        return perfil

    def get(self, request):
        return Response(DadosTermoAlunoSerializer(self._perfil(request)).data)

    def patch(self, request):
        perfil = self._perfil(request)
        serializer = DadosTermoAlunoSerializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _vinculo_acessivel_para_termo(usuario, pk, travar=False):
    queryset = VinculoBolsista.objects.select_related(
        "aluno__perfil_aluno",
        "bolsa__edital",
        "bolsa__projeto__coordenador_projeto__usuario",
        "termo_compromisso",
    )
    if travar:
        queryset = queryset.select_for_update()
    if usuario.role == Usuario.Role.ALUNO:
        return get_object_or_404(queryset, pk=pk, aluno=usuario)
    if usuario.role == Usuario.Role.COORDENADOR_PROJETO:
        return get_object_or_404(
            queryset, pk=pk, bolsa__projeto__coordenador_projeto__usuario=usuario
        )
    raise Http404


class GerarTermoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = _vinculo_do_coordenador(request.user, pk, travar=True)
        if vinculo.status == StatusVinculo.DESLIGADO:
            raise ValidationError({"detail": "Não é possível gerar termo para vínculo desligado."})
        try:
            perfil = vinculo.aluno.perfil_aluno
        except Aluno.DoesNotExist:
            raise ValidationError(
                {"detail": "O aluno precisa informar a data de nascimento."}
            ) from None
        if not perfil.data_nascimento:
            raise ValidationError({"detail": "O aluno precisa informar a data de nascimento."})
        if (
            calcular_idade(perfil.data_nascimento) < 18
            and not perfil.nome_responsavel_legal.strip()
        ):
            raise ValidationError(
                {"detail": "O aluno precisa informar o nome do responsável legal."}
            )

        termo = TermoCompromisso.objects.filter(vinculo=vinculo).first()
        if termo and termo.assinado:
            raise ValidationError({"detail": "O termo assinado já foi enviado."})
        tipo, conteudo = gerar_docx_termo(vinculo, perfil)
        criado = termo is None
        if termo is None:
            termo = TermoCompromisso(vinculo=vinculo, gerado_por=request.user)
        arquivo_anterior = termo.arquivo_gerado.name if termo.arquivo_gerado else ""
        assinatura_aluno_anterior = (
            termo.arquivo_assinado_aluno.name if termo.arquivo_assinado_aluno else ""
        )
        termo.tipo = tipo
        termo.data_nascimento = perfil.data_nascimento
        termo.nome_responsavel_legal = perfil.nome_responsavel_legal.strip()
        termo.gerado_por = request.user
        termo.gerado_em = timezone.now()
        termo.arquivo_assinado_aluno = ""
        termo.nome_original_assinado_aluno = ""
        termo.enviado_aluno_em = None
        termo.arquivo_gerado.save(
            f"termo_vinculo_{vinculo.pk}.docx", ContentFile(conteudo), save=False
        )
        termo.save()
        if arquivo_anterior and arquivo_anterior != termo.arquivo_gerado.name:
            termo.arquivo_gerado.storage.delete(arquivo_anterior)
        if assinatura_aluno_anterior:
            termo.arquivo_assinado_aluno.storage.delete(assinatura_aluno_anterior)
        return Response(
            TermoCompromissoSerializer(termo, context={"request": request}).data,
            status=status.HTTP_201_CREATED if criado else status.HTTP_200_OK,
        )


class TermoDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk)
        termo = get_object_or_404(TermoCompromisso, vinculo=vinculo)
        if not termo.arquivo_gerado:
            raise Http404
        return FileResponse(
            termo.arquivo_gerado.open("rb"),
            as_attachment=True,
            filename=f"termo_compromisso_{vinculo.pk}.docx",
            content_type=(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ),
        )


class TermoAssinadoView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk, travar=True)
        if vinculo.status == StatusVinculo.DESLIGADO:
            raise ValidationError({"detail": "O vínculo está desligado."})
        termo = get_object_or_404(TermoCompromisso.objects.select_for_update(), vinculo=vinculo)
        serializer_class = (
            EnvioTermoAlunoSerializer
            if request.user.role == Usuario.Role.ALUNO
            else EnvioTermoFinalSerializer
        )
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        arquivo = serializer.validated_data["arquivo"]

        if termo.assinado:
            raise ValidationError({"detail": "O termo final já foi enviado."})

        if request.user.role == Usuario.Role.ALUNO:
            anterior = termo.arquivo_assinado_aluno.name if termo.arquivo_assinado_aluno else ""
            termo.arquivo_assinado_aluno = arquivo
            termo.nome_original_assinado_aluno = arquivo.name
            termo.enviado_aluno_em = timezone.now()
            termo.save(
                update_fields=[
                    "arquivo_assinado_aluno",
                    "nome_original_assinado_aluno",
                    "enviado_aluno_em",
                ]
            )
            if anterior and anterior != termo.arquivo_assinado_aluno.name:
                termo.arquivo_assinado_aluno.storage.delete(anterior)
            registrar_log(
                usuario=request.user,
                acao=AcaoAuditoria.ATUALIZACAO,
                entidade=EntidadeAuditoria.BOLSA,
                entidade_id=vinculo.bolsa_id,
                descricao=(
                    f"{vinculo.aluno.nome} enviou sua parte assinada do termo do projeto "
                    f'"{vinculo.bolsa.projeto.titulo}" para revisão do coordenador.'
                ),
            )
            return Response(TermoCompromissoSerializer(termo, context={"request": request}).data)

        if not termo.aluno_assinou:
            raise ValidationError(
                {"detail": "O aluno ainda não enviou sua parte assinada do termo."}
            )

        anterior = termo.arquivo_assinado.name if termo.arquivo_assinado else ""
        termo.arquivo_assinado = arquivo
        termo.nome_original_assinado = arquivo.name
        termo.enviado_por = request.user
        termo.enviado_em = timezone.now()
        termo.save()
        if anterior and anterior != termo.arquivo_assinado.name:
            termo.arquivo_assinado.storage.delete(anterior)

        vinculo.status = StatusVinculo.ATIVO
        if vinculo.data_inicio is None:
            vinculo.data_inicio = timezone.localdate()
        vinculo.save(update_fields=["status", "data_inicio"])
        atualizar_status_preenchimento(vinculo.bolsa)
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.ATIVACAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=vinculo.bolsa_id,
            descricao=f'Termo assinado enviado para {vinculo.aluno.nome} no projeto "{vinculo.bolsa.projeto.titulo}".',
        )
        return Response(TermoCompromissoSerializer(termo, context={"request": request}).data)


class TermoAssinadoAlunoDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk)
        termo = get_object_or_404(TermoCompromisso, vinculo=vinculo)
        if not termo.arquivo_assinado_aluno:
            raise Http404
        return FileResponse(
            termo.arquivo_assinado_aluno.open("rb"),
            as_attachment=True,
            filename=(
                termo.nome_original_assinado_aluno or f"termo_assinado_aluno_{vinculo.pk}.docx"
            ),
        )


class TermoAssinadoDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk)
        termo = get_object_or_404(TermoCompromisso, vinculo=vinculo)
        if not termo.arquivo_assinado:
            raise Http404
        return FileResponse(
            termo.arquivo_assinado.open("rb"),
            as_attachment=True,
            filename=termo.nome_original_assinado or f"termo_assinado_{vinculo.pk}.pdf",
        )


class SolicitarMeuDesligamentoView(APIView):
    """O aluno solicita o desligamento e aguarda a decisão do coordenador do projeto."""

    permission_classes = [IsAuthenticated, IsAluno]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = get_object_or_404(
            VinculoBolsista.objects.select_for_update().select_related("bolsa__projeto"),
            pk=pk,
            aluno=request.user,
        )
        _garantir_vinculo_ativo(vinculo)
        serializer = MotivoDesligamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        solicitacao = SolicitacaoDesligamento.objects.create(
            vinculo=vinculo,
            solicitante=request.user,
            origem=OrigemDesligamento.ALUNO,
            motivo=serializer.validated_data["motivo"],
        )
        return Response(
            SolicitacaoDesligamentoSerializer(solicitacao).data,
            status=status.HTTP_201_CREATED,
        )


class MeusPedidosDesligamentoView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsAluno]
    serializer_class = SolicitacaoDesligamentoSerializer
    pagination_class = None

    def get_queryset(self):
        return SolicitacaoDesligamento.objects.filter(
            vinculo__aluno=self.request.user
        ).select_related("vinculo__aluno", "vinculo__bolsa__projeto", "solicitante")


class SolicitarDesligamentoCoordenadorView(APIView):
    """O coordenador desliga imediatamente um bolsista do próprio projeto."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = _vinculo_do_coordenador(request.user, pk, travar=True)
        _garantir_vinculo_ativo(vinculo)
        serializer = MotivoDesligamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        solicitacao = SolicitacaoDesligamento.objects.create(
            vinculo=vinculo,
            solicitante=request.user,
            origem=OrigemDesligamento.COORDENADOR_PROJETO,
            motivo=serializer.validated_data["motivo"],
        )
        efetivar_desligamento(solicitacao, request.user)
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.DESATIVACAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=vinculo.bolsa_id,
            descricao=(
                f"{vinculo.aluno.nome} foi desligado(a) da bolsa do projeto "
                f'"{vinculo.bolsa.projeto.titulo}". Motivo: {solicitacao.motivo}'
            ),
        )
        return Response(
            SolicitacaoDesligamentoSerializer(solicitacao).data,
            status=status.HTTP_201_CREATED,
        )


class PedidosDesligamentoPendentesView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    serializer_class = SolicitacaoDesligamentoSerializer
    pagination_class = None

    def get_queryset(self):
        return SolicitacaoDesligamento.objects.filter(
            vinculo__bolsa__projeto__coordenador_projeto__usuario=self.request.user,
            origem=OrigemDesligamento.ALUNO,
            status=StatusSolicitacaoDesligamento.PENDENTE,
        ).select_related("vinculo__aluno", "vinculo__bolsa__projeto", "solicitante")


class DecidirDesligamentoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        solicitacao = get_object_or_404(
            SolicitacaoDesligamento.objects.select_for_update().select_related(
                "vinculo__aluno", "vinculo__bolsa__projeto"
            ),
            pk=pk,
            origem=OrigemDesligamento.ALUNO,
            vinculo__bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        if solicitacao.status != StatusSolicitacaoDesligamento.PENDENTE:
            raise ValidationError({"detail": "Este pedido de desligamento já foi decidido."})

        serializer = DecisaoDesligamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        aprovar = serializer.validated_data["aprovar"]

        if aprovar:
            if solicitacao.vinculo.status != StatusVinculo.ATIVO:
                raise ValidationError({"detail": "Este vínculo já foi desligado."})
            efetivar_desligamento(solicitacao, request.user)
        else:
            solicitacao.status = StatusSolicitacaoDesligamento.REJEITADA
            solicitacao.decidido_por = request.user
            solicitacao.decidida_em = timezone.now()
            solicitacao.justificativa_decisao = serializer.validated_data["justificativa"]
            solicitacao.save(
                update_fields=[
                    "status",
                    "decidido_por",
                    "decidida_em",
                    "justificativa_decisao",
                ]
            )

        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.APROVACAO if aprovar else AcaoAuditoria.REJEICAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=solicitacao.vinculo.bolsa_id,
            descricao=(
                f"Pedido de desligamento de {solicitacao.vinculo.aluno.nome} "
                f"{'aprovado' if aprovar else 'rejeitado'}."
            ),
        )
        return Response(SolicitacaoDesligamentoSerializer(solicitacao).data)


class CancelarVagaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = _vinculo_do_coordenador(request.user, pk, travar=True)
        if vinculo.status != StatusVinculo.DESLIGADO:
            raise ValidationError(
                {"detail": "A vaga só pode ser cancelada depois do desligamento do bolsista."}
            )
        if CancelamentoVaga.objects.filter(vinculo=vinculo).exists():
            raise ValidationError({"detail": "Esta vaga já foi cancelada."})

        serializer = MotivoDesligamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        cancelamento = CancelamentoVaga.objects.create(
            vinculo=vinculo,
            solicitado_por=request.user,
            justificativa=serializer.validated_data["motivo"],
        )
        atualizar_status_preenchimento(vinculo.bolsa)
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.CANCELAMENTO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=vinculo.bolsa_id,
            descricao=(
                f'Uma vaga da bolsa do projeto "{vinculo.bolsa.projeto.titulo}" foi cancelada. '
                f"Justificativa: {cancelamento.justificativa}"
            ),
        )
        return Response(
            CancelamentoVagaSerializer(cancelamento).data,
            status=status.HTTP_201_CREATED,
        )


class DesligamentosRecentesAreaView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    serializer_class = SolicitacaoDesligamentoSerializer
    pagination_class = None

    def get_queryset(self):
        return SolicitacaoDesligamento.objects.filter(
            status=StatusSolicitacaoDesligamento.APROVADA,
            vinculo__bolsa__coordenador_area__usuario=self.request.user,
        ).select_related("vinculo__aluno", "vinculo__bolsa__projeto", "solicitante")


class CienciaDesligamentoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    def post(self, request, pk):
        solicitacao = get_object_or_404(
            SolicitacaoDesligamento,
            pk=pk,
            status=StatusSolicitacaoDesligamento.APROVADA,
            vinculo__bolsa__coordenador_area__usuario=request.user,
        )
        if solicitacao.ciencia_area_em is None:
            solicitacao.ciencia_area_em = timezone.now()
            solicitacao.save(update_fields=["ciencia_area_em"])
        return Response(SolicitacaoDesligamentoSerializer(solicitacao).data)


class CancelamentosRecentesAreaView(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    serializer_class = CancelamentoVagaSerializer
    pagination_class = None

    def get_queryset(self):
        return CancelamentoVaga.objects.filter(
            vinculo__bolsa__coordenador_area__usuario=self.request.user
        ).select_related("vinculo__aluno", "vinculo__bolsa__projeto", "solicitado_por")


class CienciaCancelamentoVagaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    def post(self, request, pk):
        cancelamento = get_object_or_404(
            CancelamentoVaga,
            pk=pk,
            vinculo__bolsa__coordenador_area__usuario=request.user,
        )
        if cancelamento.ciencia_area_em is None:
            cancelamento.ciencia_area_em = timezone.now()
            cancelamento.save(update_fields=["ciencia_area_em"])
        return Response(CancelamentoVagaSerializer(cancelamento).data)


class SolicitarRelatorioView(APIView):
    """O coordenador do projeto solicita o relatório final a um bolsista."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = get_object_or_404(
            VinculoBolsista.objects.select_for_update().select_related(
                "aluno", "bolsa__edital", "bolsa__projeto"
            ),
            pk=pk,
            bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        motivo = motivo_bloqueio_solicitacao(vinculo)
        if motivo:
            raise ValidationError({"detail": motivo})

        vinculo.relatorio_final = RelatorioFinal.objects.create(
            vinculo=vinculo, solicitado_por=request.user
        )
        return Response(
            VinculoDoCoordenadorSerializer(vinculo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class RelatorioFinalView(APIView):
    """Envio do relatório final pelo bolsista; um reenvio substitui o arquivo e volta para avaliação."""

    permission_classes = [IsAuthenticated, IsAluno]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = get_object_or_404(
            VinculoBolsista.objects.select_for_update().select_related("bolsa__edital"),
            pk=pk,
            aluno=request.user,
        )
        motivo = motivo_bloqueio_envio(vinculo)
        if motivo:
            raise ValidationError({"detail": motivo})

        serializer = EnvioRelatorioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        arquivo = serializer.validated_data["arquivo"]

        relatorio = relatorio_do_vinculo(vinculo)
        arquivo_anterior = relatorio.arquivo.name

        relatorio.arquivo = arquivo
        relatorio.nome_original = arquivo.name
        relatorio.enviado_em = timezone.now()
        relatorio.situacao = SituacaoRelatorio.AGUARDANDO_AVALIACAO
        relatorio.justificativa = ""
        relatorio.avaliado_por = None
        relatorio.avaliado_em = None
        relatorio.save()

        # O arquivo anterior só sai do disco depois que o novo foi salvo.
        if arquivo_anterior and arquivo_anterior != relatorio.arquivo.name:
            relatorio.arquivo.storage.delete(arquivo_anterior)

        return Response(RelatorioFinalSerializer(relatorio, context={"request": request}).data)


class BolsistasDoCoordenadorView(generics.ListAPIView):
    """Bolsistas das bolsas dos projetos do coordenador logado."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    serializer_class = VinculoDoCoordenadorSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            VinculoBolsista.objects.filter(
                bolsa__projeto__coordenador_projeto__usuario=self.request.user
            )
            .select_related(
                "aluno",
                "aluno__perfil_aluno",
                "bolsa__edital",
                "bolsa__projeto",
                "relatorio_final",
                "termo_compromisso",
                "cancelamento_vaga",
            )
            .order_by("bolsa__projeto__titulo", "aluno__nome")
        )


class BolsasParaFinalizarView(generics.ListAPIView):
    """Bolsas da área do coordenador que têm bolsistas, com o andamento dos relatórios finais."""

    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    serializer_class = BolsaParaFinalizarSerializer
    pagination_class = None

    def get_queryset(self):
        area = self.request.user.perfil_coordenador_area.tipo_area
        return (
            Bolsa.objects.filter(tipo__in=[area, TipoBolsa.INDISSOCIAVEL], vinculos__isnull=False)
            .exclude(
                status__in=[StatusBolsa.SOLICITADA, StatusBolsa.REJEITADA, StatusBolsa.CANCELADA]
            )
            .select_related("projeto__coordenador_projeto__usuario", "edital")
            .annotate(
                total_bolsistas=Count(
                    "vinculos",
                    filter=Q(vinculos__status=StatusVinculo.ATIVO),
                    distinct=True,
                ),
                relatorios_aprovados=Count(
                    "vinculos",
                    filter=Q(
                        vinculos__status=StatusVinculo.ATIVO,
                        vinculos__relatorio_final__situacao=SituacaoRelatorio.APROVADO,
                    ),
                    distinct=True,
                ),
            )
            .order_by("status", "projeto__titulo")
        )


def relatorios_do_coordenador(usuario):
    return RelatorioFinal.objects.filter(
        vinculo__bolsa__projeto__coordenador_projeto__usuario=usuario
    )


class ParecerRelatorioView(APIView):
    """Parecer do coordenador do projeto sobre o relatório final que aguarda avaliação."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        relatorio = get_object_or_404(
            relatorios_do_coordenador(request.user)
            .select_for_update()
            .select_related("vinculo__aluno", "vinculo__bolsa__projeto"),
            vinculo_id=pk,
        )
        if not bolsa_aceita_acompanhamento(relatorio.vinculo.bolsa):
            raise ValidationError({"detail": MOTIVO_BOLSA_ENCERRADA})
        if relatorio.situacao != SituacaoRelatorio.AGUARDANDO_AVALIACAO:
            raise ValidationError({"detail": "Este relatório não está aguardando avaliação."})

        serializer = ParecerSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        relatorio.situacao = serializer.validated_data["situacao"]
        relatorio.justificativa = serializer.validated_data["justificativa"]
        relatorio.avaliado_por = request.user
        relatorio.avaliado_em = timezone.now()
        relatorio.save(update_fields=["situacao", "justificativa", "avaliado_por", "avaliado_em"])

        # Registra só o parecer: num reenvio, o parecer anterior sai do relatório e fica aqui.
        vinculo = relatorio.vinculo
        alvo = (
            f"Relatório final de {vinculo.aluno.nome} na bolsa do projeto "
            f'"{vinculo.bolsa.projeto.titulo}"'
        )
        aprovado = relatorio.situacao == SituacaoRelatorio.APROVADO
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.APROVACAO if aprovado else AcaoAuditoria.REJEICAO,
            entidade=EntidadeAuditoria.RELATORIO_FINAL,
            entidade_id=relatorio.pk,
            descricao=(
                f"{alvo} aprovado."
                if aprovado
                else f"{alvo} reprovado. Justificativa: {relatorio.justificativa}"
            ),
        )

        return Response(RelatorioFinalSerializer(relatorio, context={"request": request}).data)


class RelatorioFinalArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        if request.user.role == Usuario.Role.ALUNO:
            relatorios = RelatorioFinal.objects.filter(vinculo__aluno=request.user)
        else:
            relatorios = relatorios_do_coordenador(request.user)
        relatorio = get_object_or_404(relatorios, vinculo_id=pk)
        if not relatorio.arquivo:
            raise Http404("O relatório ainda não foi enviado.")
        try:
            arquivo = relatorio.arquivo.open("rb")
        except (FileNotFoundError, OSError):
            raise Http404("Arquivo não encontrado.") from None
        return FileResponse(
            arquivo, as_attachment=True, filename=relatorio.nome_original or "relatorio-final.pdf"
        )
