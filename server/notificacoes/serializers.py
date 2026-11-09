from rest_framework import serializers

from .models import Notificacao


class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = ["id", "tom", "titulo", "mensagem", "destino", "criada_em", "lida_em"]
        read_only_fields = fields
