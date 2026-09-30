from rest_framework import serializers

TAMANHO_MAX_UPLOAD_MB = 10


def validar_upload(arquivo, extensoes_permitidas, tamanho_max_mb=TAMANHO_MAX_UPLOAD_MB):
    nome = arquivo.name or ""
    extensao = nome.rsplit(".", 1)[-1].lower() if "." in nome else ""

    if extensao not in extensoes_permitidas:
        permitidas = ", ".join(f".{ext}" for ext in extensoes_permitidas)
        raise serializers.ValidationError(f"Formato não permitido. Envie {permitidas}.")

    if arquivo.size > tamanho_max_mb * 1024 * 1024:
        raise serializers.ValidationError(f"O arquivo deve ter no máximo {tamanho_max_mb} MB.")

    return arquivo
