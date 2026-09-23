from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers

from bolsas.models import StatusBolsa

from .models import Documento, Inscricao, NotificacaoInscricao, StatusInscricao, TipoDocumento

MAX_INSCRICOES_ATIVAS_POR_EDITAL = 3


class DocumentoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Documento
        fields = ["id", "tipo", "tipo_display", "nome_original", "arquivo", "enviado_em"]
        read_only_fields = ["id", "nome_original", "enviado_em"]

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        caminho = reverse("inscricoes:documento-arquivo", kwargs={"pk": instance.pk})
        request = self.context.get("request")
        dados["arquivo"] = request.build_absolute_uri(caminho) if request else caminho
        return dados


class NotificacaoInscricaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificacaoInscricao
        fields = ["id", "mensagem", "criada_em", "lida_em"]
        read_only_fields = fields


class InscricaoSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    documentos = DocumentoSerializer(many=True, read_only=True)
    notificacoes = NotificacaoInscricaoSerializer(many=True, read_only=True)

    class Meta:
        model = Inscricao
        fields = [
            "id",
            "bolsa",
            "projeto_titulo",
            "edital_nome",
            "bolsa_tipo_display",
            "status",
            "status_display",
            "termos_aceitos",
            "link_lattes",
            "data_criacao",
            "data_envio",
            "data_cancelamento",
            "documentos",
            "justificativa_indeferimento",
            "data_decisao",
            "notificacoes",
        ]
        read_only_fields = [
            "id",
            "status",
            "data_criacao",
            "data_envio",
            "data_cancelamento",
            "justificativa_indeferimento",
            "data_decisao",
        ]

    def validate_bolsa(self, bolsa):
        if self.instance and bolsa != self.instance.bolsa:
            raise serializers.ValidationError(
                "Não é possível trocar a bolsa de uma inscrição já criada."
            )

        if self.instance is None:
            hoje = timezone.localdate()
            if bolsa.status != StatusBolsa.ABERTA:
                raise serializers.ValidationError("Esta bolsa não está com inscrições abertas.")
            if not (
                bolsa.edital.data_abertura_inscricoes
                <= hoje
                <= bolsa.edital.data_fechamento_inscricoes
            ):
                raise serializers.ValidationError(
                    "O prazo de inscrição deste edital não está aberto."
                )

            aluno = self.context["request"].user

            if (
                Inscricao.objects.filter(aluno=aluno, bolsa=bolsa)
                .exclude(status=StatusInscricao.CANCELADA)
                .exists()
            ):
                raise serializers.ValidationError(
                    "Você já tem uma inscrição ativa para esta bolsa."
                )

            ativas_no_edital = Inscricao.objects.filter(
                aluno=aluno, bolsa__edital=bolsa.edital
            ).exclude(status=StatusInscricao.CANCELADA)
            if ativas_no_edital.count() >= MAX_INSCRICOES_ATIVAS_POR_EDITAL:
                raise serializers.ValidationError(
                    f"Você já atingiu o limite de {MAX_INSCRICOES_ATIVAS_POR_EDITAL} "
                    "inscrições simultâneas neste edital."
                )

        return bolsa


class CandidatoSerializer(serializers.ModelSerializer):
    aluno_nome = serializers.SerializerMethodField()
    aluno_email = serializers.EmailField(source="aluno.email", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    documentacao_completa = serializers.SerializerMethodField()

    class Meta:
        model = Inscricao
        fields = [
            "id",
            "aluno_nome",
            "aluno_email",
            "status",
            "status_display",
            "data_envio",
            "documentacao_completa",
        ]
        read_only_fields = fields

    def get_aluno_nome(self, obj):
        return obj.aluno.nome or obj.aluno.get_full_name() or obj.aluno.username

    def get_documentacao_completa(self, obj):
        obrigatorios = {
            TipoDocumento.HISTORICO_ESCOLAR,
            TipoDocumento.COMPROVANTE_MATRICULA,
        }
        enviados = {documento.tipo for documento in obj.documentos.all()}
        return obrigatorios.issubset(enviados)


class CandidatoDetalheSerializer(CandidatoSerializer):
    documentos = DocumentoSerializer(many=True, read_only=True)

    class Meta(CandidatoSerializer.Meta):
        fields = CandidatoSerializer.Meta.fields + [
            "documentos",
            "link_lattes",
            "justificativa_indeferimento",
            "data_decisao",
        ]
        read_only_fields = fields


class IndeferimentoSerializer(serializers.Serializer):
    justificativa = serializers.CharField(allow_blank=False, max_length=5000, trim_whitespace=True)
