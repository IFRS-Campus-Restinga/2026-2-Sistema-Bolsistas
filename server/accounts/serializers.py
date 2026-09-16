from rest_framework import serializers

from .models import CoordenadorArea, EmailCoordenadorArea, TipoArea, Usuario


class UsuarioListSerializer(serializers.ModelSerializer):
    tipo_area = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ["id", "nome", "email", "role", "tipo_area", "is_active"]

    def get_tipo_area(self, obj):
        if obj.role == Usuario.Role.COORDENADOR_AREA:
            perfil = getattr(obj, "perfil_coordenador_area", None)
            return perfil.tipo_area if perfil else None
        return None


class CoordenadorAreaTipoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoordenadorArea
        fields = ["tipo_area"]

    def validate_tipo_area(self, value):
        if value not in TipoArea.values:
            raise serializers.ValidationError("Tipo de área inválido.")
        return value


class EmailCoordenadorAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmailCoordenadorArea
        fields = ["id", "email", "tipo_area"]

    def validate_tipo_area(self, value):
        if value not in TipoArea.values:
            raise serializers.ValidationError("Tipo de área inválido.")
        return value
