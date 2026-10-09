from django.urls import reverse
from rest_framework import serializers

from accounts.models import Aluno
from server.validators import validar_upload

from .models import DadosBancarios

EXTENSOES_COMPROVANTE = ["pdf", "jpg", "jpeg", "png"]


class DadosBancariosSerializer(serializers.ModelSerializer):
    matricula = serializers.CharField(max_length=11, write_only=True)
    curso = serializers.CharField(max_length=150, write_only=True)
    cpf = serializers.CharField(max_length=14, write_only=True)
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
            "matricula",
            "curso",
            "cpf",
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

    def _aluno_atual_id(self):
        if self.instance:
            return self.instance.aluno_id

        request = self.context.get("request")
        perfil = getattr(request.user, "perfil_aluno", None) if request else None
        return perfil.pk if perfil else None

    def validate_matricula(self, valor):
        matricula = valor.strip()

        if not matricula:
            raise serializers.ValidationError("Informe a matrícula.")

        matricula_em_uso = (
            Aluno.objects.exclude(pk=self._aluno_atual_id()).filter(matricula=matricula).exists()
        )

        if matricula_em_uso:
            raise serializers.ValidationError("Esta matrícula já está cadastrada.")

        return matricula

    def validate_curso(self, valor):
        curso = valor.strip()

        if not curso:
            raise serializers.ValidationError("Informe o curso.")

        return curso

    def validate_cpf(self, valor):
        cpf = "".join(caractere for caractere in valor if caractere.isdigit())

        if len(cpf) != 11:
            raise serializers.ValidationError("O CPF deve conter 11 números.")

        cpf_em_uso = Aluno.objects.exclude(pk=self._aluno_atual_id()).filter(cpf=cpf).exists()

        if cpf_em_uso:
            raise serializers.ValidationError("Este CPF já está cadastrado.")

        return cpf

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
            valor and valor.strip()
            for valor in [
                dados.aluno.matricula,
                dados.aluno.curso,
                dados.aluno.cpf,
                dados.banco,
                dados.agencia,
                dados.conta,
            ]
        )

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        dados["matricula"] = instance.aluno.matricula or ""
        dados["curso"] = instance.aluno.curso
        dados["cpf"] = instance.aluno.cpf or ""
        return dados

    def create(self, validated_data):
        aluno = validated_data.pop("aluno")
        aluno.matricula = validated_data.pop("matricula")
        aluno.curso = validated_data.pop("curso")
        aluno.cpf = validated_data.pop("cpf")
        aluno.save(update_fields=["matricula", "curso", "cpf"])

        return DadosBancarios.objects.create(
            aluno=aluno,
            **validated_data,
        )

    def update(self, instance, validated_data):
        aluno = instance.aluno
        aluno.matricula = validated_data.pop("matricula")
        aluno.curso = validated_data.pop("curso")
        aluno.cpf = validated_data.pop("cpf")
        aluno.save(update_fields=["matricula", "curso", "cpf"])

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
