from rest_framework import serializers

from .models import Bolsa


class BolsaSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    modalidade_display = serializers.CharField(source="get_modalidade_display", read_only=True)
    solicitante_nome = serializers.CharField(source="solicitante.nome", read_only=True)

    class Meta:
        model = Bolsa
        fields = [
            "id",
            "edital",
            "solicitante",
            "solicitante_nome",
            "modalidade",
            "modalidade_display",
            "carga_horaria_semanal",
            "valor_mensal",
            "prerequisitos",
            "nota_minima",
            "data_avaliacao",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "status",
            "status_display",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
        ]
        read_only_fields = [
            "id",
            "solicitante",
            "valor_mensal",
            "status",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
        ]

    def create(self, validated_data):
        validated_data["solicitante"] = self.context["request"].user
        validated_data["valor_mensal"] = 0
        return super().create(validated_data)