from rest_framework import serializers

from .models import NOTA_MAXIMA
from .services import (
    exige_justificativa_indicacao,
    motivo_bloqueio_desistencia,
    motivo_bloqueio_indicacao,
    motivo_bloqueio_notas,
    nome_aluno,
    pendencias_publicacao,
    resultado_publicado,
    situacao_vagas,
)


def _decimal_str(valor):
    return None if valor is None else f"{valor:.2f}"


class NotaItemSerializer(serializers.Serializer):
    etapa = serializers.IntegerField()
    nota = serializers.DecimalField(
        max_digits=4, decimal_places=2, min_value=0, max_value=NOTA_MAXIMA, allow_null=True
    )


class LancamentoNotasSerializer(serializers.Serializer):
    notas = NotaItemSerializer(many=True, allow_empty=False)

    def validate_notas(self, notas):
        etapas_da_bolsa = set(self.context["bolsa"].etapas.values_list("id", flat=True))
        vistas = set()
        for item in notas:
            if item["etapa"] not in etapas_da_bolsa:
                raise serializers.ValidationError("Etapa de avaliação não pertence a esta bolsa.")
            if item["etapa"] in vistas:
                raise serializers.ValidationError("Cada etapa só pode ter uma nota.")
            vistas.add(item["etapa"])
        return notas


class DesempateSerializer(serializers.Serializer):
    inscricoes = serializers.ListField(child=serializers.IntegerField(), min_length=2)

    def validate_inscricoes(self, inscricoes):
        if len(set(inscricoes)) != len(inscricoes):
            raise serializers.ValidationError("Cada candidato só pode aparecer uma vez.")
        return inscricoes


class DesistenciaSerializer(serializers.Serializer):
    inscricao = serializers.IntegerField()
    motivo = serializers.CharField(max_length=5000, trim_whitespace=True)


class IndicacaoSerializer(serializers.Serializer):
    inscricao = serializers.IntegerField()
    justificativa = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=True
    )


def representar_classificacao(bolsa, classificacao):
    """Visão do coordenador: notas, classificação, pendências e indicações."""
    publicacao = resultado_publicado(bolsa)
    publicados = (
        {
            resultado.inscricao_id: resultado
            for resultado in publicacao.resultados.select_related("inscricao")
        }
        if publicacao
        else {}
    )
    indicacoes = {indicacao.inscricao_id: indicacao for indicacao in bolsa.indicacoes.all()}
    desistencias = {item.inscricao_id: item for item in bolsa.desistencias.all()}
    vagas = situacao_vagas(bolsa)
    pendencias = pendencias_publicacao(bolsa, classificacao)

    candidatos = []
    for candidato in classificacao.candidatos:
        inscricao = candidato.inscricao
        oficial = publicados.get(inscricao.id)
        indicacao = indicacoes.get(inscricao.id)
        desistencia = desistencias.get(inscricao.id)
        situacao = oficial.situacao if oficial else candidato.situacao
        candidatos.append(
            {
                "inscricao": inscricao.id,
                "aluno_nome": nome_aluno(inscricao.aluno),
                "aluno_email": inscricao.aluno.email,
                "notas": {
                    str(etapa_id): _decimal_str(nota) for etapa_id, nota in candidato.notas.items()
                },
                "nota_final": _decimal_str(oficial.nota_final if oficial else candidato.nota_final),
                "situacao": situacao,
                "posicao": oficial.posicao if oficial else candidato.posicao,
                "empate": candidato.empate,
                "empate_pendente": candidato.empate_pendente and not publicacao,
                "indicacao": (
                    {
                        "justificativa": indicacao.justificativa,
                        "indicado_em": indicacao.indicado_em,
                    }
                    if indicacao
                    else None
                ),
                "desistencia": (
                    {"motivo": desistencia.motivo, "registrada_em": desistencia.registrada_em}
                    if desistencia
                    else None
                ),
                "pode_indicar": bool(oficial and not motivo_bloqueio_indicacao(oficial, vagas)),
                "exige_justificativa_indicacao": bool(
                    oficial and exige_justificativa_indicacao(oficial, vagas)
                ),
                "pode_registrar_desistencia": bool(
                    oficial and not motivo_bloqueio_desistencia(oficial, vagas)
                ),
            }
        )

    motivo_notas = motivo_bloqueio_notas(bolsa)
    return {
        "bolsa": {
            "id": bolsa.id,
            "projeto_titulo": bolsa.projeto.titulo,
            "edital_nome": bolsa.edital.nome,
            "status": bolsa.status,
            "status_display": bolsa.get_status_display(),
            "quantidade_vagas": bolsa.quantidade_vagas,
            "nota_minima": _decimal_str(bolsa.nota_minima),
        },
        "etapas": [
            {
                "id": etapa.id,
                "nome": etapa.nome,
                "peso_efetivo": _decimal_str(classificacao.pesos.get(etapa.id)),
            }
            for etapa in classificacao.etapas
        ],
        "pode_lancar_notas": not motivo_notas,
        "motivo_bloqueio_notas": motivo_notas,
        "publicado_em": publicacao.publicado_em if publicacao else None,
        "pendencias_publicacao": [] if publicacao else pendencias,
        "pode_publicar": not pendencias,
        "vagas_preenchidas": len(indicacoes),
        "vagas_para_suplentes": vagas.vagas_para_suplentes if vagas else 0,
        "candidatos": candidatos,
    }


def representar_resultado_publico(bolsa, inscricao_do_aluno=None, mostrar_notas=True):
    """Resultado oficial visível a todos os candidatos da bolsa (sem notas para alunos)."""
    publicacao = resultado_publicado(bolsa)
    resultados = publicacao.resultados.select_related("inscricao__aluno")
    # Classificados pela posição; desclassificados (sem posição) no fim, pela nota.
    linhas = sorted(resultados, key=lambda r: (r.posicao is None, r.posicao or 0, -r.nota_final))
    return {
        "bolsa": bolsa.id,
        "projeto_titulo": bolsa.projeto.titulo,
        "edital_nome": bolsa.edital.nome,
        "quantidade_vagas": bolsa.quantidade_vagas,
        "nota_minima": _decimal_str(bolsa.nota_minima),
        "publicado_em": publicacao.publicado_em,
        "mostra_notas": mostrar_notas,
        "resultados": [
            {
                "posicao": resultado.posicao,
                "aluno_nome": nome_aluno(resultado.inscricao.aluno),
                **({"nota_final": _decimal_str(resultado.nota_final)} if mostrar_notas else {}),
                "situacao": resultado.situacao,
                "situacao_display": resultado.get_situacao_display(),
                "sou_eu": resultado.inscricao_id == inscricao_do_aluno,
            }
            for resultado in linhas
        ],
    }
