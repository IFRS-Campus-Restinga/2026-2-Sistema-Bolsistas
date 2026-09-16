import re

from django.db import transaction
from rest_framework import serializers

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
    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_codigo",
            "link_documento_oficial",
            "status",
            *CAMPOS_CRONOGRAMA,
        ]
        read_only_fields = ["id", "status"]

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
