import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from bolsas.models import TipoBolsaModalidade

from .models import AlteracaoCronograma, Edital

ETAPAS = [
    ("data_abertura_inscricoes", "Abertura das inscrições"),
    ("data_fechamento_inscricoes", "Fechamento das inscrições"),
    ("data_homologacao", "Homologação"),
    ("data_recurso_homologacao_inicio", "Início dos recursos"),
    ("data_recurso_homologacao_fim", "Fim dos recursos"),
    ("data_resultado", "Resultado"),
    ("data_entrega_relatorios", "Entrega de relatórios"),
]

CAMPOS_CRONOGRAMA = [campo for campo, _ in ETAPAS]


def validar_cronograma(attrs, instance=None, obrigatorio=False):
    erros = {}
    data_anterior = None
    nome_anterior = None

    for campo, nome in ETAPAS:
        data = attrs.get(campo, getattr(instance, campo, None))

        if data is None:
            if obrigatorio:
                erros[campo] = "Esta data é obrigatória para um edital em vigor."
            continue

        if data_anterior is not None and data < data_anterior:
            erros[campo] = f"{nome} não pode ser anterior a {nome_anterior.lower()}."

        data_anterior = data
        nome_anterior = nome

    if erros:
        raise serializers.ValidationError(erros)


class EditalSerializer(serializers.ModelSerializer):
    prazo_inscricao_encerrado = serializers.SerializerMethodField()

    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_codigo",
            "link_documento_oficial",
            "status",
            "prazo_inscricao_encerrado",
            *CAMPOS_CRONOGRAMA,
            "dia_limite_frequencia",
        ]
        read_only_fields = ["id", "status"]
        extra_kwargs = {
            "dia_limite_frequencia": {
                "error_messages": {
                    "min_value": "Informe um dia entre 1 e 31.",
                    "max_value": "Informe um dia entre 1 e 31.",
                }
            }
        }

    def get_prazo_inscricao_encerrado(self, edital):
        if edital.data_fechamento_inscricoes is None:
            return False
        return timezone.localdate() > edital.data_fechamento_inscricoes

    def validate_ano_codigo(self, value):
        if not re.fullmatch(r"[0-9]{4}-[0-9]{3}", value):
            raise serializers.ValidationError(
                "Informe o ano/código no formato AAAA-NNN, como 2026-005."
            )
        return value

    def validate(self, attrs):
        if self.instance and self.instance.status in (
            Edital.Status.ENCERRADO,
            Edital.Status.ARQUIVADO,
        ):
            raise serializers.ValidationError(
                "Editais encerrados ou arquivados não podem ser editados."
            )

        em_vigor = self.instance is not None and self.instance.status == Edital.Status.EM_VIGOR

        validar_cronograma(
            attrs,
            instance=self.instance,
            obrigatorio=em_vigor,
        )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        alteracoes = []

        if instance.status == Edital.Status.EM_VIGOR:
            for campo in CAMPOS_CRONOGRAMA:
                if campo not in validated_data:
                    continue

                anterior = getattr(instance, campo)
                nova = validated_data[campo]

                if anterior != nova:
                    alteracoes.append(
                        AlteracaoCronograma(
                            edital=instance,
                            campo=campo,
                            data_anterior=anterior,
                            data_nova=nova,
                            responsavel=self.context["request"].user,
                        )
                    )

        instance = super().update(instance, validated_data)
        AlteracaoCronograma.objects.bulk_create(alteracoes)

        return instance


class CronogramaEditalSerializer(EditalSerializer):
    class Meta:
        model = Edital
        fields = CAMPOS_CRONOGRAMA


class ValorBolsaItemSerializer(serializers.Serializer):
    tipo_bolsa_modalidade = serializers.IntegerField()
    valor_mensal = serializers.DecimalField(
        max_digits=10, decimal_places=2, min_value=Decimal("0.01")
    )


class ValoresBolsaEditalSerializer(serializers.Serializer):
    """Substitui o conjunto de modalidades + CH disponíveis no edital e seus valores."""

    valores = ValorBolsaItemSerializer(many=True)

    def validate_valores(self, valores):
        catalogo = {item.id: item for item in TipoBolsaModalidade.objects.all()}
        vistos = set()
        erros = []
        for item in valores:
            tipo = catalogo.get(item["tipo_bolsa_modalidade"])
            if tipo is None:
                erros.append("Combinação de modalidade e carga horária inexistente no catálogo.")
                continue
            if tipo.id in vistos:
                erros.append(f"A combinação {tipo} foi informada mais de uma vez.")
                continue
            vistos.add(tipo.id)
            if item["valor_mensal"] > tipo.valor_maximo:
                erros.append(
                    f"O valor de {tipo} não pode passar do máximo institucional "
                    f"(R$ {tipo.valor_maximo})."
                )
            item["tipo"] = tipo
        if erros:
            raise serializers.ValidationError(erros)
        return valores


def representar_valores_bolsa(edital):
    configurados = {
        valor.tipo_bolsa_modalidade_id: valor.valor_mensal for valor in edital.valores_bolsa.all()
    }
    return [
        {
            "tipo_bolsa_modalidade": tipo.id,
            "modalidade": tipo.modalidade,
            "modalidade_display": tipo.get_modalidade_display(),
            "carga_horaria_semanal": tipo.carga_horaria_semanal,
            "valor_maximo": f"{tipo.valor_maximo:.2f}",
            "disponivel": tipo.id in configurados,
            "valor_mensal": (f"{configurados[tipo.id]:.2f}" if tipo.id in configurados else None),
        }
        for tipo in TipoBolsaModalidade.objects.all()
    ]
