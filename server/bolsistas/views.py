from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Aluno, Usuario
from accounts.permissions import IsAluno, IsCoordenadorArea, IsCoordenadorProjeto
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa, fim_vigencia_efetivo
from notificacoes.services import (
    Destino,
    Notificacao,
    coordenador_do_projeto,
    coordenadores_da_bolsa,
)

from .models import (
    CancelamentoVaga,
    OrigemDesligamento,
    OrigemVinculo,
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
    fora_do_prazo,
    motivo_bloqueio_envio,
    motivo_bloqueio_finalizacao,
    motivo_bloqueio_lembrete_termo,
    motivo_bloqueio_solicitacao,
    relatorio_do_vinculo,
)
from .serializers import (
    BolsaDoCoordenadorProjetoSerializer,
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
    SolicitacaoRelatorioSerializer,
    TermoCompromissoSerializer,
    VinculoDoCoordenadorSerializer,
)
from .services import atualizar_status_preenchimento, efetivar_desligamento
from .termos import motivo_dados_termo_incompletos, termo_atual_do_aluno


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
    if vinculo.status == StatusVinculo.DESLIGADO:
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
    """Data de nascimento e responsável legal: definem qual modelo de termo o aluno assina."""

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


def _perfil_completo_para_termo(aluno):
    """Sem a data de nascimento (e o responsável, se menor) o aluno não assina o termo."""
    perfil = getattr(aluno, "perfil_aluno", None)
    motivo = motivo_dados_termo_incompletos(perfil)
    if motivo:
        raise ValidationError({"detail": motivo})
    return perfil


def _apagar_depois_do_commit(storage, nome):
    transaction.on_commit(lambda: storage.delete(nome))


def _termo_pendente_do_coordenador(request, pk):
    """Vínculo provisório do projeto do coordenador, com o termo travado para a decisão."""
    vinculo = _vinculo_do_coordenador(request.user, pk, travar=True)
    if vinculo.status != StatusVinculo.AGUARDANDO_TERMO:
        raise ValidationError({"detail": "Este vínculo não está aguardando o termo."})
    termo = TermoCompromisso.objects.select_for_update().filter(vinculo=vinculo).first()
    return vinculo, termo


class TermoDownloadView(APIView):
    """Termo para assinar. O aluno recebe o termo gerado com os dados atuais do perfil."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def get(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk)
        if request.user.role == Usuario.Role.ALUNO:
            if vinculo.status != StatusVinculo.AGUARDANDO_TERMO:
                raise Http404
            perfil = _perfil_completo_para_termo(vinculo.aluno)
            termo = termo_atual_do_aluno(vinculo, perfil, request.user)
        else:
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
    """O aluno envia a parte assinada; o coordenador revisa e envia o termo final, que efetiva
    o vínculo."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, pk):
        vinculo = _vinculo_acessivel_para_termo(request.user, pk, travar=True)
        if vinculo.status != StatusVinculo.AGUARDANDO_TERMO:
            raise ValidationError({"detail": "Este vínculo não está aguardando o termo."})
        aluno = request.user.role == Usuario.Role.ALUNO
        serializer_class = EnvioTermoAlunoSerializer if aluno else EnvioTermoFinalSerializer
        serializer = serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        arquivo = serializer.validated_data["arquivo"]
        if aluno:
            return self._envio_do_aluno(request, vinculo, arquivo)
        return self._envio_final(request, vinculo, arquivo)

    def _envio_do_aluno(self, request, vinculo, arquivo):
        perfil = _perfil_completo_para_termo(vinculo.aluno)
        termo = termo_atual_do_aluno(vinculo, perfil, request.user)
        termo = TermoCompromisso.objects.select_for_update().get(pk=termo.pk)
        if termo.assinado:
            raise ValidationError({"detail": "O termo final já foi enviado."})

        anterior = termo.arquivo_assinado_aluno.name if termo.arquivo_assinado_aluno else ""
        termo.arquivo_assinado_aluno = arquivo
        termo.nome_original_assinado_aluno = arquivo.name
        termo.enviado_aluno_em = timezone.now()
        termo.motivo_recusa_aluno = ""
        termo.save(
            update_fields=[
                "arquivo_assinado_aluno",
                "nome_original_assinado_aluno",
                "enviado_aluno_em",
                "motivo_recusa_aluno",
            ]
        )
        if anterior and anterior != termo.arquivo_assinado_aluno.name:
            _apagar_depois_do_commit(termo.arquivo_assinado_aluno.storage, anterior)
        Notificacao.para(coordenador_do_projeto(vinculo.bolsa)).aviso().titulo(
            "Termo aguardando revisão"
        ).mensagem(
            f"{vinculo.aluno.nome} enviou sua parte assinada do Termo de Compromisso "
            f'do projeto "{vinculo.bolsa.projeto.titulo}".'
        ).destino(Destino.PROJETO_BOLSISTAS).enviar()
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

    def _envio_final(self, request, vinculo, arquivo):
        termo = TermoCompromisso.objects.select_for_update().filter(vinculo=vinculo).first()
        if termo is None or not termo.aluno_assinou:
            raise ValidationError(
                {"detail": "O aluno ainda não enviou sua parte assinada do termo."}
            )
        if termo.assinado:
            raise ValidationError({"detail": "O termo final já foi enviado."})

        termo.arquivo_assinado = arquivo
        termo.nome_original_assinado = arquivo.name
        termo.enviado_por = request.user
        termo.enviado_em = timezone.now()
        termo.save()

        vinculo.status = StatusVinculo.ATIVO
        if vinculo.data_inicio is None:
            vinculo.data_inicio = timezone.localdate()
        vinculo.save(update_fields=["status", "data_inicio"])
        atualizar_status_preenchimento(vinculo.bolsa)
        Notificacao.para(vinculo.aluno).sucesso().titulo(
            "Termo de compromisso finalizado"
        ).mensagem(
            f'O Termo de Compromisso do projeto "{vinculo.bolsa.projeto.titulo}" foi '
            "finalizado e seu vínculo está ativo."
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
        bolsa = vinculo.bolsa
        if vinculo.origem == OrigemVinculo.VINCULO_DIRETO:
            # Frequências é onde a área acompanha cada bolsista, inclusive o recém-efetivado.
            Notificacao.para(bolsa.coordenador_area).info().titulo(
                "Vínculo direto efetivado"
            ).mensagem(
                f"{vinculo.aluno.nome} passou a ser bolsista da bolsa do projeto "
                f'"{bolsa.projeto.titulo}" (edital {bolsa.edital.nome}) por vínculo direto.'
            ).destino(Destino.AREA_FREQUENCIAS).enviar()
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.ATIVACAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=vinculo.bolsa_id,
            descricao=(
                f"Termo assinado enviado para {vinculo.aluno.nome} no projeto "
                f'"{vinculo.bolsa.projeto.titulo}".'
            ),
        )
        return Response(TermoCompromissoSerializer(termo, context={"request": request}).data)


class RecusarTermoAlunoView(APIView):
    """O coordenador devolve a assinatura do aluno com o motivo; o aluno envia outra."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo, termo = _termo_pendente_do_coordenador(request, pk)
        if termo is None or not termo.aluno_assinou:
            raise ValidationError({"detail": "O aluno ainda não enviou sua parte assinada."})
        serializer = MotivoDesligamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        motivo = serializer.validated_data["motivo"]

        anterior = termo.arquivo_assinado_aluno.name
        storage = termo.arquivo_assinado_aluno.storage
        termo.arquivo_assinado_aluno = ""
        termo.nome_original_assinado_aluno = ""
        termo.enviado_aluno_em = None
        termo.motivo_recusa_aluno = motivo
        termo.save(
            update_fields=[
                "arquivo_assinado_aluno",
                "nome_original_assinado_aluno",
                "enviado_aluno_em",
                "motivo_recusa_aluno",
            ]
        )
        _apagar_depois_do_commit(storage, anterior)
        Notificacao.para(vinculo.aluno).erro().titulo("Termo de compromisso recusado").mensagem(
            f'O coordenador do projeto "{vinculo.bolsa.projeto.titulo}" recusou o termo '
            f"enviado. Motivo: {motivo}"
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.BOLSA,
            entidade_id=vinculo.bolsa_id,
            descricao=(
                f"Termo de {vinculo.aluno.nome} recusado no projeto "
                f'"{vinculo.bolsa.projeto.titulo}". Motivo: {motivo}'
            ),
        )
        return Response(TermoCompromissoSerializer(termo, context={"request": request}).data)


class LembreteTermoView(APIView):
    """Lembrete ao aluno que ainda não enviou o termo; no máximo um por dia."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        vinculo, termo = _termo_pendente_do_coordenador(request, pk)
        motivo = motivo_bloqueio_lembrete_termo(vinculo, termo)
        if motivo:
            raise ValidationError({"detail": motivo})
        vinculo.lembrete_termo_em = timezone.now()
        vinculo.save(update_fields=["lembrete_termo_em"])
        Notificacao.para(vinculo.aluno).aviso().titulo("Preencha o termo de compromisso").mensagem(
            f'O coordenador do projeto "{vinculo.bolsa.projeto.titulo}" lembra que o termo de '
            "compromisso precisa ser preenchido e assinado para efetivar o seu vínculo."
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        bolsa = vinculo.bolsa
        Notificacao.para(coordenador_do_projeto(bolsa)).aviso().titulo(
            "Pedido de desligamento"
        ).mensagem(
            f"{request.user.nome} pediu desligamento da bolsa do projeto "
            f'"{bolsa.projeto.titulo}". Motivo: {solicitacao.motivo}'
        ).destino(Destino.PROJETO_BOLSISTAS).enviar()
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
        Notificacao.para(vinculo.aluno).erro().titulo("Desligamento da bolsa").mensagem(
            f'Você foi desligado(a) da bolsa do projeto "{vinculo.bolsa.projeto.titulo}". '
            f"Motivo: {solicitacao.motivo}"
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
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
            if solicitacao.vinculo.status == StatusVinculo.DESLIGADO:
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

        projeto = solicitacao.vinculo.bolsa.projeto.titulo
        aviso = Notificacao.para(solicitacao.vinculo.aluno)
        if aprovar:
            aviso.info().titulo("Desligamento aprovado").mensagem(
                f'Seu pedido de desligamento da bolsa do projeto "{projeto}" foi aprovado.'
            )
        else:
            aviso.erro().titulo("Desligamento recusado").mensagem(
                f'Seu pedido de desligamento da bolsa do projeto "{projeto}" foi recusado. '
                f"Justificativa: {solicitacao.justificativa_decisao}"
            )
        aviso.destino(Destino.ALUNO_MINHA_BOLSA).enviar()

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
        Notificacao.para(coordenadores_da_bolsa(vinculo.bolsa)).aviso().titulo(
            "Vaga cancelada"
        ).mensagem(
            f'Uma vaga da bolsa do projeto "{vinculo.bolsa.projeto.titulo}" foi cancelada. '
            f"Justificativa: {cancelamento.justificativa}"
        ).destino(Destino.AREA_MOVIMENTACOES).enviar()
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
    """O coordenador do projeto solicita o relatório final a um bolsista, podendo anexar
    um modelo para o bolsista seguir."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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

        serializer = SolicitacaoRelatorioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        modelo = serializer.validated_data.get("modelo")

        vinculo.relatorio_final = RelatorioFinal.objects.create(
            vinculo=vinculo,
            solicitado_por=request.user,
            modelo=modelo or "",
            nome_original_modelo=modelo.name if modelo else "",
        )
        Notificacao.para(vinculo.aluno).aviso().titulo("Relatório final solicitado").mensagem(
            f'Envie o relatório final da bolsa do projeto "{vinculo.bolsa.projeto.titulo}".'
        ).destino(Destino.ALUNO_MINHA_BOLSA).enviar()
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
        relatorio.fora_do_prazo = fora_do_prazo(vinculo.bolsa.edital)
        relatorio.situacao = SituacaoRelatorio.AGUARDANDO_AVALIACAO
        relatorio.justificativa = ""
        relatorio.avaliado_por = None
        relatorio.avaliado_em = None
        relatorio.save()

        # O arquivo anterior só sai do disco depois que a transação confirmar; se algo falhar
        # até lá (inclusive o aviso), o banco volta e ele continua valendo.
        if arquivo_anterior and arquivo_anterior != relatorio.arquivo.name:
            storage = relatorio.arquivo.storage
            transaction.on_commit(lambda: storage.delete(arquivo_anterior))

        bolsa = vinculo.bolsa
        Notificacao.para(coordenador_do_projeto(bolsa)).info().titulo(
            "Relatório final enviado"
        ).mensagem(
            f"{request.user.nome} enviou o relatório final da bolsa do projeto "
            f'"{bolsa.projeto.titulo}". Ele aguarda sua avaliação.'
        ).destino(Destino.PROJETO_FINALIZACAO).enviar()

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
    """Bolsas da área do coordenador para acompanhar a finalização: as em andamento com
    bolsista ativo e as encerradas, que pedem ciência."""

    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    serializer_class = BolsaParaFinalizarSerializer
    pagination_class = None

    def get_queryset(self):
        area = self.request.user.perfil_coordenador_area.tipo_area
        return (
            Bolsa.objects.filter(
                Q(status=StatusBolsa.ENCERRADA, vinculos__isnull=False)
                | Q(vinculos__status=StatusVinculo.ATIVO),
                tipo__in=[area, TipoBolsa.INDISSOCIAVEL],
            )
            .exclude(
                status__in=[StatusBolsa.SOLICITADA, StatusBolsa.REJEITADA, StatusBolsa.CANCELADA]
            )
            .select_related("projeto__coordenador_projeto__usuario", "edital", "finalizada_por")
            .prefetch_related(
                Prefetch(
                    "vinculos",
                    queryset=VinculoBolsista.objects.select_related("aluno", "relatorio_final"),
                )
            )
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

        bolsa = vinculo.bolsa
        aviso = Notificacao.para(vinculo.aluno).destino(Destino.ALUNO_MINHA_BOLSA)
        if aprovado:
            aviso.sucesso().titulo("Relatório final aprovado").mensagem(
                f'Seu relatório final da bolsa do projeto "{bolsa.projeto.titulo}" foi aprovado.'
            ).enviar()
            # Quem finaliza é o próprio coordenador do projeto, que acabou de dar o parecer.
            if not motivo_bloqueio_finalizacao(bolsa):
                Notificacao.para(request.user).info().titulo(
                    "Bolsa pronta para finalizar"
                ).mensagem(
                    f'Todos os relatórios finais da bolsa do projeto "{bolsa.projeto.titulo}" '
                    "foram aprovados. A bolsa já pode ser finalizada."
                ).destino(Destino.PROJETO_FINALIZACAO).enviar()
        else:
            aviso.erro().titulo("Relatório final reprovado").mensagem(
                f'Seu relatório final da bolsa do projeto "{bolsa.projeto.titulo}" foi '
                f"reprovado. Justificativa: {relatorio.justificativa}"
            ).enviar()

        return Response(RelatorioFinalSerializer(relatorio, context={"request": request}).data)


def _relatorio_visivel(usuario, pk):
    """Relatório do vínculo, visível ao próprio bolsista e ao coordenador do projeto."""
    if usuario.role == Usuario.Role.ALUNO:
        relatorios = RelatorioFinal.objects.filter(vinculo__aluno=usuario)
    else:
        relatorios = relatorios_do_coordenador(usuario)
    return get_object_or_404(relatorios, vinculo_id=pk)


def _baixar(campo, nome):
    try:
        arquivo = campo.open("rb")
    except (FileNotFoundError, OSError):
        raise Http404("Arquivo não encontrado.") from None
    return FileResponse(arquivo, as_attachment=True, filename=nome)


class RelatorioFinalArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        relatorio = _relatorio_visivel(request.user, pk)
        if not relatorio.arquivo:
            raise Http404("O relatório ainda não foi enviado.")
        return _baixar(relatorio.arquivo, relatorio.nome_original or "relatorio-final.pdf")


class ModeloRelatorioArquivoView(APIView):
    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, pk):
        relatorio = _relatorio_visivel(request.user, pk)
        if not relatorio.modelo:
            raise Http404("Nenhum modelo foi anexado a este relatório.")
        return _baixar(relatorio.modelo, relatorio.nome_original_modelo or "modelo-relatorio")


class BolsasDoCoordenadorProjetoView(generics.ListAPIView):
    """Bolsas dos projetos do coordenador logado para a Finalização: as em andamento com
    bolsista ativo e as já encerradas."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    serializer_class = BolsaDoCoordenadorProjetoSerializer
    pagination_class = None

    def get_queryset(self):
        return (
            Bolsa.objects.filter(
                Q(status=StatusBolsa.ENCERRADA, vinculos__isnull=False)
                | Q(vinculos__status=StatusVinculo.ATIVO),
                projeto__coordenador_projeto__usuario=self.request.user,
            )
            .exclude(
                status__in=[StatusBolsa.SOLICITADA, StatusBolsa.REJEITADA, StatusBolsa.CANCELADA]
            )
            .distinct()
            .select_related("projeto", "edital", "finalizada_por")
            .prefetch_related(
                Prefetch(
                    "vinculos",
                    queryset=VinculoBolsista.objects.select_related(
                        "aluno",
                        "bolsa__edital",
                        "bolsa__projeto",
                        "relatorio_final",
                        "cancelamento_vaga",
                    ).order_by("aluno__nome"),
                )
            )
            .order_by(fim_vigencia_efetivo(), "id")
        )
