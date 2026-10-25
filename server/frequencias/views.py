from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAluno, IsCoordenadorArea, IsCoordenadorProjeto
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsistas.models import VinculoBolsista
from bolsistas.regras import MOTIVO_BOLSA_ENCERRADA, bolsa_aceita_acompanhamento

from .models import Frequencia, SolicitacaoFrequencia, StatusPagamento
from .regras import frequencia_pendente, meses_do_vinculo, motivo_bloqueio_lancamento
from .serializers import (
    CriacaoSolicitacaoFrequenciaSerializer,
    DecisaoPagamentoSerializer,
    FrequenciaSerializer,
    LancamentoFrequenciaSerializer,
    MesReferenciaField,
    SolicitacaoFrequenciaSerializer,
)
from .services import (
    frequencias_indexadas,
    historico_do_aluno,
    mes_do_coordenador,
    pendencias_da_area,
    planilha_de_acompanhamento,
    situacao_da_area,
    solicitacoes_abertas_indexadas,
    vinculos_da_area,
)


def vinculos_do_coordenador(usuario):
    return VinculoBolsista.objects.filter(
        bolsa__projeto__coordenador_projeto__usuario=usuario
    ).select_related("aluno", "bolsa__edital", "bolsa__projeto")


def _mes_da_consulta(request):
    valor = request.query_params.get("mes")
    if not valor:
        hoje = timezone.localdate()
        return hoje.replace(day=1)
    try:
        return MesReferenciaField().to_internal_value(valor)
    except ValidationError:
        raise ValidationError({"mes": "Informe o mês no formato AAAA-MM, como 2026-10."}) from None


def _descricao(vinculo, mes):
    return (
        f"Frequência de {vinculo.aluno.nome} em {mes:%m/%Y} na bolsa do projeto "
        f'"{vinculo.bolsa.projeto.titulo}"'
    )


class FrequenciasDoMesView(APIView):
    """Bolsistas do coordenador no mês consultado, com a frequência de cada um."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get(self, request):
        mes = _mes_da_consulta(request)
        hoje = timezone.localdate()
        vinculos = [
            vinculo
            for vinculo in vinculos_do_coordenador(request.user).order_by(
                "bolsa__projeto__titulo", "aluno__nome"
            )
            if mes in meses_do_vinculo(vinculo, hoje)
        ]
        frequencias = frequencias_indexadas(vinculos)
        solicitacoes = solicitacoes_abertas_indexadas(vinculos)
        linhas = [
            mes_do_coordenador(
                vinculo,
                mes,
                frequencias.get((vinculo.id, mes)),
                solicitacoes.get((vinculo.id, mes)),
                hoje,
            )
            for vinculo in vinculos
        ]
        return Response({"mes": f"{mes:%Y-%m}", "bolsistas": linhas})


class LancarFrequenciaView(APIView):
    """Lança a frequência mensal de um bolsista; relançar o mesmo mês corrige o lançamento."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request):
        serializer = LancamentoFrequenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        mes = dados["mes_referencia"]

        vinculo = get_object_or_404(
            vinculos_do_coordenador(request.user).select_for_update(), pk=dados["vinculo"]
        )
        frequencia = Frequencia.objects.filter(vinculo=vinculo, mes_referencia=mes).first()
        motivo = motivo_bloqueio_lancamento(vinculo, mes, frequencia)
        if motivo:
            raise ValidationError({"detail": motivo})

        criada = frequencia is None
        if criada:
            frequencia = Frequencia(
                vinculo=vinculo,
                mes_referencia=mes,
                fora_do_prazo=frequencia_pendente(vinculo, mes, None),
            )
        frequencia.registrada = dados["registrada"]
        frequencia.observacoes = dados["observacoes"]
        frequencia.lancada_por = request.user
        frequencia.save()

        SolicitacaoFrequencia.objects.filter(
            vinculo=vinculo, mes_referencia=mes, atendida_em__isnull=True
        ).update(atendida_em=timezone.now())

        situacao = "registrada" if frequencia.registrada else "não registrada"
        atraso = " Lançada fora do prazo do edital." if frequencia.fora_do_prazo else ""
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.CRIACAO if criada else AcaoAuditoria.ATUALIZACAO,
            entidade=EntidadeAuditoria.FREQUENCIA,
            entidade_id=frequencia.pk,
            descricao=f"{_descricao(vinculo, mes)} {'lançada' if criada else 'corrigida'} como "
            f"{situacao}.{atraso}",
        )
        return Response(
            FrequenciaSerializer(frequencia).data,
            status=status.HTTP_201_CREATED if criada else status.HTTP_200_OK,
        )


class DecidirPagamentoView(APIView):
    """Autoriza ou nega o pagamento do mês; é só um status interno, sem processamento financeiro."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    @transaction.atomic
    def post(self, request, pk):
        frequencia = get_object_or_404(
            Frequencia.objects.select_for_update().select_related(
                "vinculo__aluno", "vinculo__bolsa__projeto"
            ),
            pk=pk,
            vinculo__bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        if not bolsa_aceita_acompanhamento(frequencia.vinculo.bolsa):
            raise ValidationError({"detail": MOTIVO_BOLSA_ENCERRADA})
        if frequencia.status_pagamento != StatusPagamento.PENDENTE:
            raise ValidationError({"detail": "O pagamento deste mês já foi decidido."})

        serializer = DecisaoPagamentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        autorizar = serializer.validated_data["autorizar"]
        if autorizar and not frequencia.registrada:
            raise ValidationError(
                {
                    "detail": "Só é possível autorizar o pagamento de um mês com frequência registrada."
                }
            )

        frequencia.status_pagamento = (
            StatusPagamento.AUTORIZADO if autorizar else StatusPagamento.NEGADO
        )
        frequencia.justificativa_pagamento = serializer.validated_data["justificativa"]
        frequencia.pagamento_decidido_por = request.user
        frequencia.pagamento_decidido_em = timezone.now()
        frequencia.save(
            update_fields=[
                "status_pagamento",
                "justificativa_pagamento",
                "pagamento_decidido_por",
                "pagamento_decidido_em",
            ]
        )

        vinculo = frequencia.vinculo
        alvo = (
            f"Pagamento de {vinculo.aluno.nome} em {frequencia.mes_referencia:%m/%Y} na bolsa do "
            f'projeto "{vinculo.bolsa.projeto.titulo}"'
        )
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.APROVACAO if autorizar else AcaoAuditoria.REJEICAO,
            entidade=EntidadeAuditoria.FREQUENCIA,
            entidade_id=frequencia.pk,
            descricao=(
                f"{alvo} autorizado."
                if autorizar
                else f"{alvo} negado. Justificativa: {frequencia.justificativa_pagamento}"
            ),
        )
        return Response(FrequenciaSerializer(frequencia).data)


class SolicitacoesRecebidasView(generics.ListAPIView):
    """Cobranças de frequência em aberto que o coordenador de área enviou ao coordenador logado."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]
    serializer_class = SolicitacaoFrequenciaSerializer
    pagination_class = None

    def get_queryset(self):
        return SolicitacaoFrequencia.objects.filter(
            vinculo__bolsa__projeto__coordenador_projeto__usuario=self.request.user,
            atendida_em__isnull=True,
        ).select_related("vinculo__aluno", "vinculo__bolsa__projeto", "solicitante")


class CienciaSolicitacaoView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def post(self, request, pk):
        solicitacao = get_object_or_404(
            SolicitacaoFrequencia.objects.select_related(
                "vinculo__aluno", "vinculo__bolsa__projeto", "solicitante"
            ),
            pk=pk,
            vinculo__bolsa__projeto__coordenador_projeto__usuario=request.user,
        )
        if solicitacao.lida_em is None:
            solicitacao.lida_em = timezone.now()
            solicitacao.save(update_fields=["lida_em"])
        return Response(SolicitacaoFrequenciaSerializer(solicitacao).data)


class ExportarAcompanhamentoView(APIView):
    """Planilha de acompanhamento dos bolsistas do coordenador, para prestação de contas."""

    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get(self, request):
        vinculos = (
            vinculos_do_coordenador(request.user)
            .select_related("relatorio_final")
            .order_by("bolsa__projeto__titulo", "aluno__nome")
        )
        conteudo = BytesIO()
        planilha_de_acompanhamento(vinculos).save(conteudo)

        resposta = HttpResponse(
            conteudo.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        hoje = timezone.localdate().isoformat()
        resposta["Content-Disposition"] = f'attachment; filename="acompanhamento-{hoje}.xlsx"'
        return resposta


class SituacaoAreaView(APIView):
    """Painel do coordenador de área: status de cada bolsista em cada mês do ano."""

    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    def get(self, request):
        hoje = timezone.localdate()
        try:
            ano = int(request.query_params.get("ano", hoje.year))
        except ValueError:
            raise ValidationError({"ano": "Informe um ano válido."}) from None
        return Response(situacao_da_area(request.user, ano, hoje))


class PendenciasAreaView(APIView):
    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    def get(self, request):
        return Response(pendencias_da_area(request.user))


class SolicitarFrequenciaView(APIView):
    """O coordenador de área cobra do coordenador do projeto uma frequência em atraso."""

    permission_classes = [IsAuthenticated, IsCoordenadorArea]

    @transaction.atomic
    def post(self, request):
        serializer = CriacaoSolicitacaoFrequenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data
        mes = dados["mes_referencia"]

        vinculo = get_object_or_404(
            vinculos_da_area(request.user).select_for_update(), pk=dados["vinculo"]
        )
        if not bolsa_aceita_acompanhamento(vinculo.bolsa):
            raise ValidationError({"detail": MOTIVO_BOLSA_ENCERRADA})
        if mes not in meses_do_vinculo(vinculo):
            raise ValidationError(
                {"detail": f"{mes:%m/%Y} está fora do período deste bolsista na bolsa."}
            )
        frequencia = Frequencia.objects.filter(vinculo=vinculo, mes_referencia=mes).first()
        if not frequencia_pendente(vinculo, mes, frequencia):
            raise ValidationError(
                {"detail": "Só é possível solicitar frequências não lançadas após o prazo."}
            )
        if SolicitacaoFrequencia.objects.filter(
            vinculo=vinculo, mes_referencia=mes, atendida_em__isnull=True
        ).exists():
            raise ValidationError(
                {"detail": "Já existe uma solicitação em aberto para este bolsista neste mês."}
            )

        solicitacao = SolicitacaoFrequencia.objects.create(
            vinculo=vinculo,
            mes_referencia=mes,
            solicitante=request.user,
            mensagem=dados["mensagem"],
        )
        registrar_log(
            usuario=request.user,
            acao=AcaoAuditoria.CRIACAO,
            entidade=EntidadeAuditoria.FREQUENCIA,
            entidade_id=solicitacao.pk,
            descricao=f"Lançamento solicitado ao coordenador do projeto: {_descricao(vinculo, mes)}.",
        )
        return Response(
            SolicitacaoFrequenciaSerializer(solicitacao).data, status=status.HTTP_201_CREATED
        )


class MinhasFrequenciasView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]

    def get(self, request):
        return Response(historico_do_aluno(request.user))
