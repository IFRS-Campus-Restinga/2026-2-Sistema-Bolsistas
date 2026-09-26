from django.urls import reverse
from rest_framework import serializers

from .models import AnexoRecurso, Recurso, StatusRecurso

MAX_ANEXOS_RECURSO = 5


class EnvioRecursoSerializer(serializers.Serializer):
    justificativa = serializers.CharField(max_length=5000, allow_blank=False, trim_whitespace=True)
    anexos = serializers.ListField(
        child=serializers.FileField(max_length=255),
        max_length=MAX_ANEXOS_RECURSO,
        required=False,
        default=list,
    )


class JulgamentoRecursoSerializer(serializers.Serializer):
    decisao = serializers.ChoiceField(choices=[StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO])
    justificativa = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=True
    )

    def validate(self, attrs):
        if attrs["decisao"] == StatusRecurso.INDEFERIDO and not attrs["justificativa"]:
            raise serializers.ValidationError(
                {"justificativa": "Informe o motivo do indeferimento do recurso."}
            )
        return attrs


class AnexoRecursoSerializer(serializers.ModelSerializer):
    arquivo = serializers.SerializerMethodField()

    class Meta:
        model = AnexoRecurso
        fields = ["id", "nome_original", "arquivo"]
        read_only_fields = fields

    def get_arquivo(self, obj):
        url = reverse("inscricoes:recurso-anexo", kwargs={"pk": obj.pk})
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class RecursoSerializer(serializers.ModelSerializer):
    anexos = AnexoRecursoSerializer(many=True, read_only=True)

    class Meta:
        model = Recurso
        fields = [
            "id",
            "etapa",
            "justificativa",
            "motivo_contestado",
            "status",
            "criado_em",
            "julgado_em",
            "justificativa_julgamento",
            "anexos",
        ]
        read_only_fields = fields
