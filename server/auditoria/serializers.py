from rest_framework import serializers

from .models import LogAuditoria


class LogAuditoriaSerializer(serializers.ModelSerializer):
    acao_display = serializers.CharField(source="get_acao_display", read_only=True)
    entidade_display = serializers.CharField(source="get_entidade_display", read_only=True)
    usuario_nome = serializers.SerializerMethodField()
    usuario_email = serializers.SerializerMethodField()

    class Meta:
        model = LogAuditoria
        fields = [
            "id",
            "acao",
            "acao_display",
            "usuario_nome",
            "usuario_email",
            "data_hora",
            "entidade",
            "entidade_display",
            "entidade_id",
            "descricao",
        ]
        read_only_fields = fields

    def get_usuario_nome(self, log):
        return log.usuario_nome or "Sistema"

    def get_usuario_email(self, log):
        return log.usuario_email or None
