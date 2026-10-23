from django.urls import reverse
from rest_framework import serializers

from bolsas.models import Bolsa, StatusBolsa
from server.validators import validar_upload

from .models import (
    EXTENSOES_RELATORIO,
    TAMANHO_MAX_RELATORIO_MB,
    RelatorioFinal,
    SituacaoRelatorio,
    VinculoBolsista,
)
from .regras import (
    motivo_bloqueio_envio,
    motivo_bloqueio_finalizacao,
    motivo_bloqueio_solicitacao,
    relatorio_do_vinculo,
)


class EnvioRelatorioSerializer(serializers.Serializer):
    arquivo = serializers.FileField()

    def validate_arquivo(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_RELATORIO, TAMANHO_MAX_RELATORIO_MB)


class ParecerSerializer(serializers.Serializer):
    situacao = serializers.ChoiceField(
        choices=[SituacaoRelatorio.APROVADO, SituacaoRelatorio.REPROVADO]
    )
    justificativa = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs["justificativa"] = attrs["justificativa"].strip()
        if attrs["situacao"] == SituacaoRelatorio.REPROVADO and not attrs["justificativa"]:
            raise serializers.ValidationError(
                {"justificativa": "Informe a justificativa da reprovação."}
            )
        return attrs


class RelatorioFinalSerializer(serializers.ModelSerializer):
    situacao_display = serializers.CharField(source="get_situacao_display", read_only=True)
    arquivo = serializers.SerializerMethodField()

    class Meta:
        model = RelatorioFinal
        fields = [
            "id",
            "situacao",
            "situacao_display",
            "solicitado_em",
            "nome_original",
            "arquivo",
            "enviado_em",
            "justificativa",
            "avaliado_em",
        ]

    def get_arquivo(self, relatorio):
        if not relatorio.arquivo:
            return None
        caminho = reverse("bolsistas:relatorio-final-arquivo", kwargs={"pk": relatorio.vinculo_id})
        request = self.context.get("request")
        return request.build_absolute_uri(caminho) if request else caminho


class MeuVinculoSerializer(serializers.ModelSerializer):
    """Vínculo visto pelo próprio bolsista, com o que ele precisa para o relatório final."""

    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    bolsa_id = serializers.IntegerField(source="bolsa.id", read_only=True)
    bolsa_status = serializers.CharField(source="bolsa.status", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    bolsa_modalidade_display = serializers.CharField(
        source="bolsa.get_modalidade_display", read_only=True
    )
    carga_horaria_semanal = serializers.IntegerField(
        source="bolsa.carga_horaria_semanal", read_only=True
    )
    valor_mensal = serializers.DecimalField(
        source="bolsa.valor_mensal", max_digits=10, decimal_places=2, read_only=True
    )
    data_inicio_vigencia = serializers.DateField(
        source="bolsa.data_inicio_vigencia", read_only=True
    )
    data_fim_vigencia = serializers.DateField(source="bolsa.data_fim_vigencia", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    coordenador_nome = serializers.CharField(
        source="bolsa.projeto.coordenador_projeto.usuario.nome", read_only=True
    )
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="bolsa.edital.ano_codigo", read_only=True)
    prazo_relatorio = serializers.DateField(
        source="bolsa.edital.data_entrega_relatorios", read_only=True
    )
    relatorio = serializers.SerializerMethodField()
    pode_enviar_relatorio = serializers.SerializerMethodField()
    motivo_bloqueio = serializers.SerializerMethodField()

    class Meta:
        model = VinculoBolsista
        fields = [
            "id",
            "origem",
            "origem_display",
            "criado_em",
            "bolsa_id",
            "bolsa_status",
            "bolsa_tipo_display",
            "bolsa_modalidade_display",
            "carga_horaria_semanal",
            "valor_mensal",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "projeto_titulo",
            "coordenador_nome",
            "edital_nome",
            "edital_ano_codigo",
            "prazo_relatorio",
            "relatorio",
            "pode_enviar_relatorio",
            "motivo_bloqueio",
        ]

    def get_relatorio(self, vinculo):
        relatorio = relatorio_do_vinculo(vinculo)
        if relatorio is None:
            return None
        return RelatorioFinalSerializer(relatorio, context=self.context).data

    def get_pode_enviar_relatorio(self, vinculo):
        return not motivo_bloqueio_envio(vinculo)

    def get_motivo_bloqueio(self, vinculo):
        return motivo_bloqueio_envio(vinculo)


class VinculoDoCoordenadorSerializer(serializers.ModelSerializer):
    """Bolsista visto pelo coordenador do projeto, com a situação do relatório final."""

    aluno_nome = serializers.CharField(source="aluno.nome", read_only=True)
    aluno_email = serializers.EmailField(source="aluno.email", read_only=True)
    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    bolsa_id = serializers.IntegerField(source="bolsa.id", read_only=True)
    bolsa_status = serializers.CharField(source="bolsa.status", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="bolsa.edital.ano_codigo", read_only=True)
    prazo_relatorio = serializers.DateField(
        source="bolsa.edital.data_entrega_relatorios", read_only=True
    )
    relatorio = serializers.SerializerMethodField()
    pode_solicitar_relatorio = serializers.SerializerMethodField()
    motivo_bloqueio_solicitacao = serializers.SerializerMethodField()

    class Meta:
        model = VinculoBolsista
        fields = [
            "id",
            "aluno_nome",
            "aluno_email",
            "origem",
            "origem_display",
            "bolsa_id",
            "bolsa_status",
            "bolsa_tipo_display",
            "projeto_titulo",
            "edital_nome",
            "edital_ano_codigo",
            "prazo_relatorio",
            "relatorio",
            "pode_solicitar_relatorio",
            "motivo_bloqueio_solicitacao",
        ]

    def get_relatorio(self, vinculo):
        relatorio = relatorio_do_vinculo(vinculo)
        if relatorio is None:
            return None
        return RelatorioFinalSerializer(relatorio, context=self.context).data

    def get_pode_solicitar_relatorio(self, vinculo):
        return not motivo_bloqueio_solicitacao(vinculo)

    def get_motivo_bloqueio_solicitacao(self, vinculo):
        return motivo_bloqueio_solicitacao(vinculo)


class BolsaParaFinalizarSerializer(serializers.ModelSerializer):
    """Bolsa vista pelo coordenador de área, com o andamento dos relatórios finais."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    projeto_titulo = serializers.CharField(source="projeto.titulo", read_only=True)
    coordenador_projeto_nome = serializers.CharField(
        source="projeto.coordenador_projeto.usuario.nome", read_only=True
    )
    edital_nome = serializers.CharField(source="edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="edital.ano_codigo", read_only=True)
    total_bolsistas = serializers.IntegerField(read_only=True)
    relatorios_aprovados = serializers.IntegerField(read_only=True)
    pode_finalizar = serializers.SerializerMethodField()
    motivo_bloqueio = serializers.SerializerMethodField()

    class Meta:
        model = Bolsa
        fields = [
            "id",
            "status",
            "status_display",
            "tipo_display",
            "projeto_titulo",
            "coordenador_projeto_nome",
            "edital_nome",
            "edital_ano_codigo",
            "total_bolsistas",
            "relatorios_aprovados",
            "pode_finalizar",
            "motivo_bloqueio",
        ]

    def get_motivo_bloqueio(self, bolsa):
        if bolsa.status == StatusBolsa.ENCERRADA:
            return ""
        return motivo_bloqueio_finalizacao(bolsa)

    def get_pode_finalizar(self, bolsa):
        return bolsa.status != StatusBolsa.ENCERRADA and not self.get_motivo_bloqueio(bolsa)
