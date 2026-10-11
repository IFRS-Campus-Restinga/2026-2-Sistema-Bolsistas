from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAluno, IsCoordenadorProjeto
from bolsas.models import Bolsa, StatusBolsa
from inscricoes.models import Inscricao, NotificacaoInscricao, StatusInscricao

from .models import (
    DesempateClassificacao,
    DesistenciaVaga,
    IndicacaoBolsista,
    NotaEtapa,
    PublicacaoResultado,
    ResultadoInscricao,
    SituacaoClassificacao,
)
from .serializers import (
    DesempateSerializer,
    DesistenciaSerializer,
    IndicacaoSerializer,
    LancamentoNotasSerializer,
    representar_classificacao,
    representar_resultado_publico,
)
from .services import (
    classificar,
    exige_justificativa_indicacao,
    motivo_bloqueio_desistencia,
    motivo_bloqueio_indicacao,
    motivo_bloqueio_notas,
    pendencias_publicacao,
    resultado_publicado,
    situacao_vagas,
)


def _bolsas_do_coordenador(usuario):
    return Bolsa.objects.select_related("projeto", "edital").filter(
        projeto__coordenador_projeto__usuario=usuario
    )


class _BolsaDoCoordenadorMixin:
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def bolsa(self, travar=False):
        queryset = _bolsas_do_coordenador(self.request.user)
        if travar:
            queryset = queryset.select_for_update(of=("self",))
        return get_object_or_404(queryset, pk=self.kwargs["bolsa_pk"])

    def resposta(self, bolsa_pk=None):
        # Recarrega a bolsa: relações reversas (publicação) podem estar em cache.
        bolsa = get_object_or_404(
            _bolsas_do_coordenador(self.request.user), pk=bolsa_pk or self.kwargs["bolsa_pk"]
        )
        return Response(representar_classificacao(bolsa, classificar(bolsa)))

    def garantir_antes_da_publicacao(self, bolsa):
        motivo = motivo_bloqueio_notas(bolsa)
        if motivo:
            raise ValidationError({"detail": motivo})


class ClassificacaoView(_BolsaDoCoordenadorMixin, APIView):
    def get(self, request, bolsa_pk):
        return self.resposta()


class LancarNotasView(_BolsaDoCoordenadorMixin, APIView):
    @transaction.atomic
    def put(self, request, bolsa_pk, inscricao_pk):
        bolsa = self.bolsa(travar=True)
        self.garantir_antes_da_publicacao(bolsa)
        inscricao = get_object_or_404(
            Inscricao.objects.select_related("aluno"),
            pk=inscricao_pk,
            bolsa=bolsa,
            status=StatusInscricao.HOMOLOGADA,
        )

        serializer = LancamentoNotasSerializer(data=request.data, context={"bolsa": bolsa})
        serializer.is_valid(raise_exception=True)

        alterou = False
        for item in serializer.validated_data["notas"]:
            atual = NotaEtapa.objects.filter(inscricao=inscricao, etapa_id=item["etapa"]).first()
            if item["nota"] is None:
                if atual:
                    atual.delete()
                    alterou = True
                continue
            if atual and atual.nota == item["nota"]:
                continue
            NotaEtapa.objects.update_or_create(
                inscricao=inscricao,
                etapa_id=item["etapa"],
                defaults={"nota": item["nota"], "lancada_por": request.user},
            )
            alterou = True

        if alterou:
            # A nota final mudou: um desempate definido antes não vale mais.
            DesempateClassificacao.objects.filter(inscricao=inscricao).delete()
            if bolsa.status == StatusBolsa.ABERTA:
                bolsa.status = StatusBolsa.EM_SELECAO
                bolsa.save(update_fields=["status"])

        return self.resposta()


class DesempateView(_BolsaDoCoordenadorMixin, APIView):
    @transaction.atomic
    def post(self, request, bolsa_pk):
        bolsa = self.bolsa(travar=True)
        self.garantir_antes_da_publicacao(bolsa)
        serializer = DesempateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordem = serializer.validated_data["inscricoes"]

        classificacao = classificar(bolsa)
        candidatos = [classificacao.por_inscricao(inscricao_id) for inscricao_id in ordem]
        if any(c is None or c.posicao is None for c in candidatos):
            raise ValidationError(
                {"detail": "Só é possível desempatar candidatos classificados nesta bolsa."}
            )
        nota = candidatos[0].nota_final
        empatados = {
            c.inscricao.id
            for c in classificacao.candidatos
            if c.posicao is not None and c.nota_final == nota
        }
        if set(ordem) != empatados:
            raise ValidationError(
                {"detail": "Informe a ordem de todos os candidatos empatados com a mesma nota."}
            )

        for posicao, inscricao_id in enumerate(ordem, start=1):
            DesempateClassificacao.objects.update_or_create(
                inscricao_id=inscricao_id, defaults={"ordem": posicao}
            )
        return self.resposta()


class PublicarResultadoView(_BolsaDoCoordenadorMixin, APIView):
    @transaction.atomic
    def post(self, request, bolsa_pk):
        bolsa = self.bolsa(travar=True)
        classificacao = classificar(bolsa)
        pendencias = pendencias_publicacao(bolsa, classificacao)
        if pendencias:
            raise ValidationError({"detail": pendencias[0], "pendencias": pendencias})

        publicacao = PublicacaoResultado.objects.create(bolsa=bolsa, responsavel=request.user)
        ResultadoInscricao.objects.bulk_create(
            ResultadoInscricao(
                publicacao=publicacao,
                inscricao=candidato.inscricao,
                posicao=candidato.posicao,
                nota_final=candidato.nota_final,
                situacao=candidato.situacao,
            )
            for candidato in classificacao.candidatos
        )

        titulo = bolsa.projeto.titulo
        NotificacaoInscricao.objects.bulk_create(
            NotificacaoInscricao(
                inscricao=candidato.inscricao,
                mensagem=(
                    f'O resultado da seleção da bolsa do projeto "{titulo}" foi publicado. '
                    f"Sua situação: {SituacaoClassificacao(candidato.situacao).label}"
                    + (f" ({candidato.posicao}º lugar)." if candidato.posicao else ".")
                ),
            )
            for candidato in classificacao.candidatos
        )
        return self.resposta()


class _ResultadoPublicadoMixin(_BolsaDoCoordenadorMixin):
    def resultado_do_candidato(self, bolsa, inscricao_id):
        publicacao = resultado_publicado(bolsa)
        if not publicacao:
            raise ValidationError(
                {"detail": "Publique o resultado da seleção antes de indicar bolsistas."}
            )
        resultado = (
            publicacao.resultados.select_related("inscricao__aluno")
            .filter(inscricao_id=inscricao_id)
            .first()
        )
        if resultado is None:
            raise ValidationError({"detail": "Candidato não encontrado no resultado publicado."})
        return resultado


class IndicarBolsistaView(_ResultadoPublicadoMixin, APIView):
    @transaction.atomic
    def post(self, request, bolsa_pk):
        bolsa = self.bolsa(travar=True)
        serializer = IndicacaoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        resultado = self.resultado_do_candidato(bolsa, dados["inscricao"])
        vagas = situacao_vagas(bolsa)
        bloqueio = motivo_bloqueio_indicacao(resultado, vagas)
        if bloqueio:
            raise ValidationError({"detail": bloqueio})

        inscricao = resultado.inscricao
        # TODO: exigir dados bancários completos do aluno quando o app dados_bancarios
        # (branch do Luiz) entrar no development-sprint-3.
        if exige_justificativa_indicacao(resultado, vagas) and not dados["justificativa"]:
            raise ValidationError(
                {
                    "justificativa": [
                        "Informe a justificativa: há suplentes mais bem colocados disponíveis."
                    ]
                }
            )

        IndicacaoBolsista.objects.create(
            bolsa=bolsa,
            inscricao=inscricao,
            justificativa=dados["justificativa"],
            responsavel=request.user,
        )
        NotificacaoInscricao.objects.create(
            inscricao=inscricao,
            mensagem=(
                f'Você foi indicado(a) como bolsista da bolsa do projeto "{bolsa.projeto.titulo}".'
            ),
        )
        if bolsa.indicacoes.count() >= bolsa.quantidade_vagas:
            bolsa.status = StatusBolsa.PREENCHIDA
            bolsa.save(update_fields=["status"])
        return self.resposta()


class DesistenciaVagaView(_ResultadoPublicadoMixin, APIView):
    """Registra que um candidato classificado não vai assumir; a vaga fica livre a um suplente."""

    @transaction.atomic
    def post(self, request, bolsa_pk):
        bolsa = self.bolsa(travar=True)
        serializer = DesistenciaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        resultado = self.resultado_do_candidato(bolsa, dados["inscricao"])
        bloqueio = motivo_bloqueio_desistencia(resultado, situacao_vagas(bolsa))
        if bloqueio:
            raise ValidationError({"detail": bloqueio})

        inscricao = resultado.inscricao
        DesistenciaVaga.objects.create(
            bolsa=bolsa, inscricao=inscricao, motivo=dados["motivo"], responsavel=request.user
        )
        NotificacaoInscricao.objects.create(
            inscricao=inscricao,
            mensagem=(
                "Foi registrado que você não vai assumir a vaga da bolsa do projeto "
                f'"{bolsa.projeto.titulo}". Motivo: {dados["motivo"]}'
            ),
        )
        return self.resposta()


class ResultadoPublicoView(APIView):
    """Resultado publicado, visível ao coordenador e a todos os candidatos da bolsa."""

    permission_classes = [IsAuthenticated, IsAluno | IsCoordenadorProjeto]

    def get(self, request, bolsa_pk):
        inscricao_do_aluno = None
        if request.user.role == Usuario.Role.ALUNO:
            inscricao = (
                Inscricao.objects.filter(
                    bolsa_id=bolsa_pk, aluno=request.user, data_envio__isnull=False
                )
                .exclude(status__in=[StatusInscricao.RASCUNHO, StatusInscricao.CANCELADA])
                .select_related("bolsa__projeto", "bolsa__edital")
                .first()
            )
            if inscricao is None:
                raise PermissionDenied("Somente candidatos desta bolsa podem ver o resultado.")
            bolsa = inscricao.bolsa
            inscricao_do_aluno = inscricao.id
        else:
            bolsa = get_object_or_404(_bolsas_do_coordenador(request.user), pk=bolsa_pk)

        if not resultado_publicado(bolsa):
            raise ValidationError({"detail": "O resultado desta bolsa ainda não foi publicado."})
        return Response(
            representar_resultado_publico(
                bolsa, inscricao_do_aluno, mostrar_notas=inscricao_do_aluno is None
            )
        )
