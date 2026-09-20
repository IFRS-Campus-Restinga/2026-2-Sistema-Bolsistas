from rest_framework import serializers

from .models import Projeto


class ProjetoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Projeto
        fields = ["id", "titulo", "descricao", "status", "coordenador_projeto", "criado_em"]
        read_only_fields = ["id", "status", "coordenador_projeto", "criado_em"]
