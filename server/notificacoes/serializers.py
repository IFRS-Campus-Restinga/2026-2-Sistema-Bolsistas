from rest_framework import serializers

from .models import Notificacao, PreferenciasPendencias


class NotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notificacao
        fields = ["id", "tom", "titulo", "mensagem", "destino", "criada_em", "lida_em"]
        read_only_fields = fields


class PreferenciasPendenciasSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciasPendencias
        fields = [
            "avisar_solicitacao_parada",
            "dias_solicitacao_parada",
            "avisar_recurso_parado",
            "dias_recurso_parado",
        ]
