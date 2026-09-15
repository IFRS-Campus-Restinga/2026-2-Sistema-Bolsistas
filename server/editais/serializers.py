import re

from rest_framework import serializers

from .models import Edital


class EditalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_semestre",
            "link_documento_oficial",
            "status",
        ]
        read_only_fields = ["id", "status"]

    def validate_ano_semestre(self, value):
        if not re.fullmatch(r"[0-9]{4}/[12]", value):
            raise serializers.ValidationError("Informe o ano/semestre no formato AAAA/1 ou AAAA/2.")
        return value


class CronogramaEditalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edital
        fields = [
            "data_abertura_inscricoes",
            "data_fechamento_inscricoes",
            "data_homologacao",
            "data_recurso_homologacao_inicio",
            "data_recurso_homologacao_fim",
            "data_resultado",
            "data_entrega_relatorios",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.status != Edital.Status.RASCUNHO:
            raise serializers.ValidationError(
                "O cronograma só pode ser configurado enquanto o edital estiver em rascunho."
            )
        etapas = [
            ("data_abertura_inscricoes", "Abertura das inscrições"),
            ("data_fechamento_inscricoes", "Fechamento das inscrições"),
            ("data_homologacao", "Homologação"),
            ("data_recurso_homologacao_inicio", "Início dos recursos"),
            ("data_recurso_homologacao_fim", "Fim dos recursos"),
            ("data_resultado", "Resultado"),
            ("data_entrega_relatorios", "Entrega de relatórios"),
        ]

        data_anterior = None
        nome_anterior = None
        erros = {}

        for campo, nome in etapas:
            data = attrs.get(
                campo,
                getattr(self.instance, campo, None),
            )

            if data is None:
                continue

            if data_anterior is not None and data < data_anterior:
                erros[campo] = f"{nome} não pode ser anterior a {nome_anterior.lower()}."

            data_anterior = data
            nome_anterior = nome

        if erros:
            raise serializers.ValidationError(erros)

        return attrs
