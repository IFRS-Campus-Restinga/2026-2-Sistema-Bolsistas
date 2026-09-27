from rest_framework import serializers

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
        extensao = arquivo.name.rsplit(".", 1)[-1].lower() if "." in arquivo.name else ""
        if extensao not in EXTENSOES_ARQUIVO_EMENTA:
            permitidas = ", ".join(f".{ext}" for ext in EXTENSOES_ARQUIVO_EMENTA)
            raise serializers.ValidationError(f"Formato não permitido. Envie {permitidas}.")
        if arquivo.size > TAMANHO_MAX_ARQUIVO_EMENTA_MB * 1024 * 1024:
            raise serializers.ValidationError(
                f"O arquivo deve ter no máximo {TAMANHO_MAX_ARQUIVO_EMENTA_MB} MB."
            )
        return arquivo
