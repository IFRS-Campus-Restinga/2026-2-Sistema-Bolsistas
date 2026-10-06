from django.urls import reverse
from rest_framework import serializers

from accounts.models import Usuario
from inscricoes.models import EXTENSOES_DOCUMENTO, Documento
from server.validators import validar_upload

from .models import ConviteVinculoDireto, StatusConvite
from .regras import bolsa_elegivel_para_convite


class DocumentoConviteSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Documento
        fields = ["id", "tipo", "tipo_display", "nome_original", "arquivo", "enviado_em"]
        read_only_fields = ["id", "nome_original", "enviado_em"]

    def validate_arquivo(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_DOCUMENTO)

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        caminho = reverse("vinculo_direto:documento-arquivo", kwargs={"pk": instance.pk})
        request = self.context.get("request")
        dados["arquivo"] = request.build_absolute_uri(caminho) if request else caminho
        return dados


class ConviteSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    aluno_nome = serializers.SerializerMethodField()
    aluno_email = serializers.EmailField(source="aluno.email", read_only=True)
    documentos = DocumentoConviteSerializer(many=True, read_only=True)

    class Meta:
        model = ConviteVinculoDireto
        fields = [
            "id",
            "bolsa",
            "projeto_titulo",
            "edital_nome",
            "bolsa_tipo_display",
            "aluno",
            "aluno_nome",
            "aluno_email",
            "status",
            "status_display",
            "termos_aceitos",
            "link_lattes",
            "data_envio_convite",
            "data_resposta_aluno",
            "data_envio_documentos",
            "data_decisao",
            "justificativa_rejeicao",
            "documentos",
        ]
        read_only_fields = [
            "id",
            "status",
            "data_envio_convite",
            "data_resposta_aluno",
            "data_envio_documentos",
            "data_decisao",
            "justificativa_rejeicao",
        ]

    def get_aluno_nome(self, convite):
        aluno = convite.aluno
        return aluno.nome or aluno.get_full_name() or aluno.username

    def validate_bolsa(self, bolsa):
        if self.instance is not None:
            if bolsa != self.instance.bolsa:
                raise serializers.ValidationError(
                    "Não é possível trocar a bolsa de um convite já criado."
                )
            return bolsa

        coordenador = self.context["request"].user
        if bolsa.projeto.coordenador_projeto.usuario_id != coordenador.id:
            raise serializers.ValidationError("Esta bolsa não pertence a um dos seus projetos.")
        if not bolsa_elegivel_para_convite(bolsa):
            raise serializers.ValidationError(
                "Esta bolsa não está elegível para vínculo direto: ou ainda não encerrou o "
                "período de recursos da homologação, ou não há vaga livre."
            )
        return bolsa

    def validate_aluno(self, aluno):
        if self.instance is not None:
            if aluno != self.instance.aluno:
                raise serializers.ValidationError(
                    "Não é possível trocar o aluno de um convite já criado."
                )
            return aluno

        if aluno.role != Usuario.Role.ALUNO:
            raise serializers.ValidationError("O convite só pode ser enviado para um aluno.")
        return aluno

    def validate(self, attrs):
        bolsa = attrs.get("bolsa")
        aluno = attrs.get("aluno")
        if (
            bolsa
            and aluno
            and ConviteVinculoDireto.objects.filter(bolsa=bolsa, aluno=aluno)
            .exclude(status__in=[StatusConvite.RECUSADO, StatusConvite.REJEITADO])
            .exists()
        ):
            raise serializers.ValidationError(
                "Já existe um convite ativo para este aluno nesta bolsa."
            )
        return attrs


class RejeitarConviteSerializer(serializers.Serializer):
    justificativa = serializers.CharField(allow_blank=False, max_length=5000, trim_whitespace=True)
    definitivo = serializers.BooleanField(default=False)
