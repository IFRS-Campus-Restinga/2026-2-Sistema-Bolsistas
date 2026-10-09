from rest_framework import serializers

from .models import LogAuditoria


class LogAuditoriaSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.SerializerMethodField()
    usuario_email = serializers.SerializerMethodField()

    class Meta:
        model = LogAuditoria
        fields = [
            "id",
            "acao",
            "usuario_nome",
            "usuario_email",
            "data_hora",
            "entidade",
            "entidade_id",
            "descricao",
        ]
        read_only_fields = fields

    def get_usuario_nome(self, log):
        return log.usuario.nome if log.usuario else "Sistema"

    def get_usuario_email(self, log):
        return log.usuario.email if log.usuario else None
