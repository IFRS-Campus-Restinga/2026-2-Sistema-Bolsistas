from django.urls import reverse
from rest_framework import serializers

from server.validators import validar_upload

from .models import DadosBancarios

EXTENSOES_COMPROVANTE = ["pdf", "jpg", "jpeg", "png"]


class DadosBancariosSerializer(serializers.ModelSerializer):
    aluno_id = serializers.UUIDField(source="aluno.usuario_id", read_only=True)
    aluno_nome = serializers.CharField(source="aluno.usuario.nome", read_only=True)
    comprovante = serializers.FileField(write_only=True, required=False)
    comprovante_url = serializers.SerializerMethodField()
    cadastro_completo = serializers.SerializerMethodField()

    class Meta:
        model = DadosBancarios
        fields = [
            "id",
            "aluno_id",
            "aluno_nome",
            "banco",
            "agencia",
            "conta",
            "comprovante",
            "comprovante_url",
            "cadastro_completo",
        ]
        read_only_fields = [
            "id",
            "aluno_id",
            "aluno_nome",
            "comprovante_url",
            "cadastro_completo",
        ]

    def validate_comprovante(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_COMPROVANTE)

    def get_comprovante_url(self, dados):
        if not dados.comprovante:
            return None

        caminho = reverse(
            "dados_bancarios:comprovante",
            kwargs={"pk": dados.pk},
        )
        request = self.context.get("request")
        return request.build_absolute_uri(caminho) if request else caminho

    def get_cadastro_completo(self, dados):
        return all(
            valor.strip()
            for valor in [
                dados.banco,
                dados.agencia,
                dados.conta,
            ]
        )

    def update(self, instance, validated_data):
        novo_comprovante = validated_data.get("comprovante")
        nome_anterior = None
        storage = None

        if novo_comprovante and instance.comprovante:
            nome_anterior = instance.comprovante.name
            storage = instance.comprovante.storage

        instance = super().update(instance, validated_data)

        if nome_anterior and nome_anterior != instance.comprovante.name:
            storage.delete(nome_anterior)

        return instance
