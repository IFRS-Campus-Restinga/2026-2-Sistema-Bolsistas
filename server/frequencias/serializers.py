import re
from datetime import date

from rest_framework import serializers

from .models import Frequencia, SolicitacaoFrequencia


class MesReferenciaField(serializers.Field):
    """Mês no formato AAAA-MM; guardado como o primeiro dia do mês."""

    default_error_messages = {"invalido": "Informe o mês no formato AAAA-MM, como 2026-10."}

    def to_internal_value(self, valor):
        encontrado = re.fullmatch(r"(\d{4})-(\d{2})(?:-\d{2})?", str(valor).strip())
        if not encontrado:
            self.fail("invalido")
        ano, mes = int(encontrado[1]), int(encontrado[2])
        if not 1 <= mes <= 12:
            self.fail("invalido")
        return date(ano, mes, 1)

    def to_representation(self, valor):
        return f"{valor:%Y-%m}"


def representar_mes(mes):
    return f"{mes:%Y-%m}"


class LancamentoFrequenciaSerializer(serializers.Serializer):
    vinculo = serializers.IntegerField()
    mes_referencia = MesReferenciaField()
    registrada = serializers.BooleanField()
    observacoes = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=True
    )

    def validate(self, attrs):
        attrs["observacoes"] = attrs["observacoes"].strip()
        if not attrs["registrada"] and not attrs["observacoes"]:
            raise serializers.ValidationError(
                {"observacoes": "Informe nas observações por que a frequência não foi registrada."}
            )
        return attrs


class DecisaoPagamentoSerializer(serializers.Serializer):
    autorizar = serializers.BooleanField()
    justificativa = serializers.CharField(
        max_length=5000,
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )

    def validate(self, attrs):
        attrs["justificativa"] = attrs["justificativa"].strip()
        if not attrs["autorizar"] and not attrs["justificativa"]:
            raise serializers.ValidationError(
                {"justificativa": "Informe o motivo da negação do pagamento."}
            )
        return attrs


class CriacaoSolicitacaoFrequenciaSerializer(serializers.Serializer):
    vinculo = serializers.IntegerField()
    mes_referencia = MesReferenciaField()
    mensagem = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=True
    )


class FrequenciaSerializer(serializers.ModelSerializer):
    mes_referencia = MesReferenciaField(read_only=True)
    status = serializers.CharField(read_only=True)
    status_display = serializers.SerializerMethodField()
    status_pagamento_display = serializers.CharField(
        source="get_status_pagamento_display", read_only=True
    )
    lancada_por_nome = serializers.CharField(source="lancada_por.nome", read_only=True)

    class Meta:
        model = Frequencia
        fields = [
            "id",
            "vinculo",
            "mes_referencia",
            "registrada",
            "status",
            "status_display",
            "observacoes",
            "lancada_por_nome",
            "lancada_em",
            "atualizada_em",
            "fora_do_prazo",
            "status_pagamento",
            "status_pagamento_display",
            "justificativa_pagamento",
            "pagamento_decidido_em",
        ]

    def get_status_display(self, frequencia):
        return frequencia.status.label


class SolicitacaoFrequenciaSerializer(serializers.ModelSerializer):
    mes_referencia = MesReferenciaField(read_only=True)
    aluno_nome = serializers.CharField(source="vinculo.aluno.nome", read_only=True)
    bolsa_id = serializers.IntegerField(source="vinculo.bolsa_id", read_only=True)
    projeto_titulo = serializers.CharField(source="vinculo.bolsa.projeto.titulo", read_only=True)
    solicitante_nome = serializers.CharField(source="solicitante.nome", read_only=True)

    class Meta:
        model = SolicitacaoFrequencia
        fields = [
            "id",
            "vinculo",
            "aluno_nome",
            "bolsa_id",
            "projeto_titulo",
            "mes_referencia",
            "solicitante_nome",
            "mensagem",
            "criada_em",
            "lida_em",
            "atendida_em",
        ]
