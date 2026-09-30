from rest_framework import serializers

from server.validators import validar_upload

from .models import EXTENSOES_ARQUIVO_EMENTA, TAMANHO_MAX_ARQUIVO_EMENTA_MB, Projeto


class ProjetoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projeto
        fields = [
            "id",
            "titulo",
            "descricao",
            "status",
            "coordenador_projeto",
            "arquivo_ementa",
            "nome_original_arquivo",
            "criado_em",
        ]
        read_only_fields = [
            "id",
            "status",
            "coordenador_projeto",
            # upload/remoção do arquivo só pelo endpoint /projetos/<id>/arquivo/
            "arquivo_ementa",
            "nome_original_arquivo",
            "criado_em",
        ]


class ArquivoEmentaSerializer(serializers.Serializer):
    arquivo = serializers.FileField()

    def validate_arquivo(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_ARQUIVO_EMENTA, TAMANHO_MAX_ARQUIVO_EMENTA_MB)
