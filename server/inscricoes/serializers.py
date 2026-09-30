import re

from django.urls import reverse
from rest_framework import serializers

from bolsas.models import StatusBolsa
from server.validators import validar_upload

from .models import (
    EXTENSOES_DOCUMENTO,
    AnexoRecurso,
    Documento,
    Inscricao,
    NotificacaoInscricao,
    Recurso,
    StatusInscricao,
    StatusRecurso,
    TipoDocumento,
)

MAX_INSCRICOES_ATIVAS_POR_EDITAL = 3


class DocumentoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Documento
        fields = ["id", "tipo", "tipo_display", "nome_original", "arquivo", "enviado_em"]
        read_only_fields = ["id", "nome_original", "enviado_em"]

    def validate_arquivo(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_DOCUMENTO)

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        caminho = reverse("inscricoes:documento-arquivo", kwargs={"pk": instance.pk})
        request = self.context.get("request")
        dados["arquivo"] = request.build_absolute_uri(caminho) if request else caminho
        return dados


class NotificacaoInscricaoSerializer(serializers.ModelSerializer):
    mensagem = serializers.SerializerMethodField()

    def get_mensagem(self, notificacao):
        # Compatibilidade com notificações antigas, sem modificar o motivo escrito.
        mensagem = notificacao.mensagem
        mensagem = re.sub(
            r"^Seu recurso #\d+ de homologação", "Seu recurso de homologação", mensagem
        )
        prefixo, separador, restante = mensagem.partition(" foi ")
        prefixo = re.sub(r" \(bolsa #\d+\)", "", prefixo)
        prefixo = re.sub(
            r", na bolsa #\d+,",
            lambda _: f', na bolsa do projeto "{notificacao.inscricao.bolsa.projeto.titulo}",',
            prefixo,
        )
        return prefixo + separador + restante

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
    prazo_inscricao_encerrado = serializers.SerializerMethodField()

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
            "prazo_inscricao_encerrado",
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

    def get_prazo_inscricao_encerrado(self, inscricao):
        return inscricao.bolsa.edital.inscricoes_encerradas()

    def validate_bolsa(self, bolsa):
        if self.instance and bolsa != self.instance.bolsa:
            raise serializers.ValidationError(
                "Não é possível trocar a bolsa de uma inscrição já criada."
            )

        if self.instance is None:
            if bolsa.status != StatusBolsa.ABERTA:
                raise serializers.ValidationError("Esta bolsa não está com inscrições abertas.")
            if not bolsa.edital.janela_inscricao_aberta():
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
                aluno=aluno,
                bolsa__edital=bolsa.edital,
                status__in=[StatusInscricao.PENDENTE, StatusInscricao.HOMOLOGADA],
            )
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


MAX_ANEXOS_RECURSO = 5


class EnvioRecursoSerializer(serializers.Serializer):
    justificativa = serializers.CharField(max_length=5000, allow_blank=False, trim_whitespace=True)
    anexos = serializers.ListField(
        child=serializers.FileField(max_length=255),
        max_length=MAX_ANEXOS_RECURSO,
        required=False,
        default=list,
    )

    def validate_anexos(self, anexos):
        return [validar_upload(anexo, EXTENSOES_DOCUMENTO) for anexo in anexos]


class JulgamentoRecursoSerializer(serializers.Serializer):
    decisao = serializers.ChoiceField(choices=[StatusRecurso.DEFERIDO, StatusRecurso.INDEFERIDO])
    justificativa = serializers.CharField(
        max_length=5000, required=False, allow_blank=True, default="", trim_whitespace=True
    )

    def validate(self, attrs):
        if attrs["decisao"] == StatusRecurso.INDEFERIDO and not attrs["justificativa"]:
            raise serializers.ValidationError(
                {"justificativa": "Informe o motivo do indeferimento do recurso."}
            )
        return attrs


class AnexoRecursoSerializer(serializers.ModelSerializer):
    arquivo = serializers.SerializerMethodField()

    class Meta:
        model = AnexoRecurso
        fields = ["id", "nome_original", "arquivo"]
        read_only_fields = fields

    def get_arquivo(self, obj):
        url = reverse("inscricoes:recurso-anexo", kwargs={"pk": obj.pk})
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url


class RecursoSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    inscricao = serializers.IntegerField(source="inscricao_id", read_only=True)
    projeto_titulo = serializers.CharField(source="inscricao.bolsa.projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="inscricao.bolsa.edital.nome", read_only=True)
    aluno_nome = serializers.SerializerMethodField()

    def get_status(self, recurso):
        # Expiração é derivada do prazo; o recurso continua aguardando julgamento.
        if recurso.status == StatusRecurso.PENDENTE and (
            recurso.inscricao.bolsa.edital.recursos_homologacao_encerrados()
        ):
            return "EXPIRADO"
        return recurso.status

    def get_aluno_nome(self, recurso):
        aluno = recurso.inscricao.aluno
        return aluno.nome or aluno.get_full_name() or aluno.username

    anexos = AnexoRecursoSerializer(many=True, read_only=True)

    class Meta:
        model = Recurso
        fields = [
            "id",
            "inscricao",
            "projeto_titulo",
            "edital_nome",
            "aluno_nome",
            "etapa",
            "justificativa",
            "motivo_contestado",
            "status",
            "criado_em",
            "julgado_em",
            "justificativa_julgamento",
            "anexos",
        ]
        read_only_fields = fields
