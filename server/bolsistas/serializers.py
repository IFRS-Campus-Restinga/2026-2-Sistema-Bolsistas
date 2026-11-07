from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers

from bolsas.models import Bolsa, StatusBolsa
from server.validators import validar_upload

from .models import (
    EXTENSOES_MODELO_RELATORIO,
    EXTENSOES_RELATORIO,
    TAMANHO_MAX_RELATORIO_MB,
    CancelamentoVaga,
    RelatorioFinal,
    SituacaoRelatorio,
    SolicitacaoDesligamento,
    StatusVinculo,
    VinculoBolsista,
)
from .regras import (
    fora_do_prazo,
    motivo_bloqueio_envio,
    motivo_bloqueio_solicitacao,
    motivos_bloqueio_finalizacao,
    prazo_relatorio_encerrado,
    relatorio_do_vinculo,
)


class SolicitacaoRelatorioSerializer(serializers.Serializer):
    modelo = serializers.FileField(required=False, allow_null=True)

    def validate_modelo(self, modelo):
        if modelo is None:
            return None
        return validar_upload(modelo, EXTENSOES_MODELO_RELATORIO, TAMANHO_MAX_RELATORIO_MB)


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
    modelo = serializers.SerializerMethodField()

    class Meta:
        model = RelatorioFinal
        fields = [
            "id",
            "situacao",
            "situacao_display",
            "solicitado_em",
            "modelo",
            "nome_original_modelo",
            "fora_do_prazo",
            "nome_original",
            "arquivo",
            "enviado_em",
            "justificativa",
            "avaliado_em",
        ]

    def _url(self, nome_rota, relatorio):
        caminho = reverse(nome_rota, kwargs={"pk": relatorio.vinculo_id})
        request = self.context.get("request")
        return request.build_absolute_uri(caminho) if request else caminho

    def get_arquivo(self, relatorio):
        if not relatorio.arquivo:
            return None
        return self._url("bolsistas:relatorio-final-arquivo", relatorio)

    def get_modelo(self, relatorio):
        if not relatorio.modelo:
            return None
        return self._url("bolsistas:relatorio-final-modelo", relatorio)


class MotivoDesligamentoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=5000, trim_whitespace=True)

    def validate_motivo(self, motivo):
        if not motivo.strip():
            raise serializers.ValidationError("Informe o motivo do desligamento.")
        return motivo.strip()


class DecisaoDesligamentoSerializer(serializers.Serializer):
    aprovar = serializers.BooleanField()
    justificativa = serializers.CharField(
        max_length=5000,
        required=False,
        allow_blank=True,
        default="",
        trim_whitespace=True,
    )

    def validate(self, attrs):
        attrs["justificativa"] = attrs["justificativa"].strip()
        if not attrs["aprovar"] and not attrs["justificativa"]:
            raise serializers.ValidationError(
                {"justificativa": "Informe o motivo da rejeição do pedido."}
            )
        return attrs


class SolicitacaoDesligamentoSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    aluno_nome = serializers.CharField(source="vinculo.aluno.nome", read_only=True)
    bolsa_id = serializers.IntegerField(source="vinculo.bolsa_id", read_only=True)
    projeto_titulo = serializers.CharField(source="vinculo.bolsa.projeto.titulo", read_only=True)
    solicitante_nome = serializers.CharField(source="solicitante.nome", read_only=True)

    class Meta:
        model = SolicitacaoDesligamento
        fields = [
            "id",
            "vinculo",
            "aluno_nome",
            "bolsa_id",
            "projeto_titulo",
            "solicitante_nome",
            "origem",
            "origem_display",
            "motivo",
            "status",
            "status_display",
            "solicitada_em",
            "decidida_em",
            "justificativa_decisao",
            "notificada_area_em",
            "ciencia_area_em",
        ]


class CancelamentoVagaSerializer(serializers.ModelSerializer):
    aluno_nome = serializers.CharField(source="vinculo.aluno.nome", read_only=True)
    bolsa_id = serializers.IntegerField(source="vinculo.bolsa_id", read_only=True)
    projeto_titulo = serializers.CharField(source="vinculo.bolsa.projeto.titulo", read_only=True)
    solicitado_por_nome = serializers.CharField(source="solicitado_por.nome", read_only=True)

    class Meta:
        model = CancelamentoVaga
        fields = [
            "id",
            "vinculo",
            "aluno_nome",
            "bolsa_id",
            "projeto_titulo",
            "solicitado_por_nome",
            "justificativa",
            "cancelada_em",
            "ciencia_area_em",
        ]


class MeuVinculoSerializer(serializers.ModelSerializer):
    """Vínculo visto pelo próprio bolsista, com o que ele precisa para o relatório final."""

    origem_display = serializers.CharField(source="get_origem_display", read_only=True)
    bolsa_id = serializers.IntegerField(source="bolsa.id", read_only=True)
    bolsa_status = serializers.CharField(source="bolsa.status", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    bolsa_modalidade = serializers.CharField(source="bolsa.modalidade", read_only=True)
    hoje = serializers.SerializerMethodField()
    bolsa_modalidade_display = serializers.CharField(
        source="bolsa.get_modalidade_display", read_only=True
    )
    carga_horaria_semanal = serializers.IntegerField(
        source="bolsa.carga_horaria_semanal", read_only=True
    )
    valor_mensal = serializers.DecimalField(
        source="bolsa.valor_mensal", max_digits=10, decimal_places=2, read_only=True
    )
    data_inicio_vigencia = serializers.DateField(source="bolsa.inicio_vigencia", read_only=True)
    data_fim_vigencia = serializers.DateField(source="bolsa.fim_vigencia", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    coordenador_nome = serializers.CharField(
        source="bolsa.projeto.coordenador_projeto.usuario.nome", read_only=True
    )
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="bolsa.edital.ano_codigo", read_only=True)
    prazo_relatorio = serializers.DateField(
        source="bolsa.edital.data_entrega_relatorios", read_only=True
    )
    prazo_relatorio_encerrado = serializers.SerializerMethodField()
    relatorio = serializers.SerializerMethodField()
    pode_enviar_relatorio = serializers.SerializerMethodField()
    motivo_bloqueio = serializers.SerializerMethodField()

    class Meta:
        model = VinculoBolsista
        fields = [
            "id",
            "origem",
            "origem_display",
            "status",
            "desligado_em",
            "criado_em",
            "bolsa_id",
            "bolsa_status",
            "bolsa_tipo_display",
            "bolsa_modalidade",
            "bolsa_modalidade_display",
            "hoje",
            "carga_horaria_semanal",
            "valor_mensal",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "projeto_titulo",
            "coordenador_nome",
            "edital_nome",
            "edital_ano_codigo",
            "prazo_relatorio",
            "prazo_relatorio_encerrado",
            "relatorio",
            "pode_enviar_relatorio",
            "motivo_bloqueio",
        ]

    def get_hoje(self, vinculo):
        """Data do servidor, para a tela contar os dias da vigência sem usar o relógio local."""
        return timezone.localdate()

    def get_relatorio(self, vinculo):
        relatorio = relatorio_do_vinculo(vinculo)
        if relatorio is None:
            return None
        return RelatorioFinalSerializer(relatorio, context=self.context).data

    def get_prazo_relatorio_encerrado(self, vinculo):
        return fora_do_prazo(vinculo.bolsa.edital)

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
    prazo_relatorio_encerrado = serializers.SerializerMethodField()
    relatorio = serializers.SerializerMethodField()
    pode_solicitar_relatorio = serializers.SerializerMethodField()
    motivo_bloqueio_solicitacao = serializers.SerializerMethodField()
    vaga_cancelada = serializers.SerializerMethodField()

    class Meta:
        model = VinculoBolsista
        fields = [
            "id",
            "aluno_nome",
            "aluno_email",
            "origem",
            "origem_display",
            "status",
            "desligado_em",
            "bolsa_id",
            "bolsa_status",
            "bolsa_tipo_display",
            "projeto_titulo",
            "edital_nome",
            "edital_ano_codigo",
            "prazo_relatorio",
            "prazo_relatorio_encerrado",
            "relatorio",
            "pode_solicitar_relatorio",
            "motivo_bloqueio_solicitacao",
            "vaga_cancelada",
        ]

    def get_relatorio(self, vinculo):
        relatorio = relatorio_do_vinculo(vinculo)
        if relatorio is None:
            return None
        return RelatorioFinalSerializer(relatorio, context=self.context).data

    def get_prazo_relatorio_encerrado(self, vinculo):
        return fora_do_prazo(vinculo.bolsa.edital)

    def get_pode_solicitar_relatorio(self, vinculo):
        return not motivo_bloqueio_solicitacao(vinculo)

    def get_motivo_bloqueio_solicitacao(self, vinculo):
        return motivo_bloqueio_solicitacao(vinculo)

    def get_vaga_cancelada(self, vinculo):
        return getattr(vinculo, "cancelamento_vaga", None) is not None


class BolsaParaFinalizarSerializer(serializers.ModelSerializer):
    """Bolsa vista pela coordenação de área, só para acompanhar: quem finaliza é o
    coordenador do projeto, e a área toma ciência das finalizadas."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modalidade_display = serializers.CharField(source="get_modalidade_display", read_only=True)
    projeto_titulo = serializers.CharField(source="projeto.titulo", read_only=True)
    coordenador_projeto_nome = serializers.CharField(
        source="projeto.coordenador_projeto.usuario.nome", read_only=True
    )
    edital_nome = serializers.CharField(source="edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="edital.ano_codigo", read_only=True)
    total_bolsistas = serializers.IntegerField(read_only=True)
    relatorios_aprovados = serializers.IntegerField(read_only=True)
    prazo_relatorio_encerrado = serializers.SerializerMethodField()
    bolsistas_nomes = serializers.SerializerMethodField()
    relatorios_fora_do_prazo = serializers.SerializerMethodField()
    pode_finalizar = serializers.SerializerMethodField()
    motivos_bloqueio = serializers.SerializerMethodField()
    finalizada_por_nome = serializers.CharField(
        source="finalizada_por.nome", read_only=True, default=""
    )

    # Vigência efetiva: a da bolsa (exceção) ou a do edital.
    data_inicio_vigencia = serializers.DateField(source="inicio_vigencia", read_only=True)
    data_fim_vigencia = serializers.DateField(source="fim_vigencia", read_only=True)

    class Meta:
        model = Bolsa
        fields = [
            "id",
            "status",
            "status_display",
            "tipo_display",
            "modalidade_display",
            "carga_horaria_semanal",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "prazo_relatorio_encerrado",
            "bolsistas_nomes",
            "relatorios_fora_do_prazo",
            "projeto_titulo",
            "coordenador_projeto_nome",
            "edital_nome",
            "edital_ano_codigo",
            "total_bolsistas",
            "relatorios_aprovados",
            "pode_finalizar",
            "motivos_bloqueio",
            "finalizada_em",
            "finalizada_por_nome",
            "ciencia_finalizacao_em",
        ]

    def get_prazo_relatorio_encerrado(self, bolsa):
        return prazo_relatorio_encerrado(bolsa)

    def get_bolsistas_nomes(self, bolsa):
        # Na bolsa encerrada, os bolsistas que concluíram; em andamento, os ativos.
        return [v.aluno.nome for v in bolsa.vinculos.all() if v.status == StatusVinculo.ATIVO]

    def get_relatorios_fora_do_prazo(self, bolsa):
        """Bolsistas cujo relatório final foi entregue depois do prazo do edital."""
        return [
            v.aluno.nome
            for v in bolsa.vinculos.all()
            if v.status == StatusVinculo.ATIVO
            and (relatorio := relatorio_do_vinculo(v))
            and relatorio.fora_do_prazo
        ]

    def get_motivos_bloqueio(self, bolsa):
        if bolsa.status == StatusBolsa.ENCERRADA:
            return []
        return motivos_bloqueio_finalizacao(bolsa)

    def get_pode_finalizar(self, bolsa):
        """Pronta para o coordenador do projeto finalizar; a área só acompanha."""
        return bolsa.status != StatusBolsa.ENCERRADA and not self.get_motivos_bloqueio(bolsa)


class BolsaDoCoordenadorProjetoSerializer(serializers.ModelSerializer):
    """Bolsa vista pelo coordenador do projeto na Finalização: bolsistas ativos com o
    relatório final, o que impede finalizar e a ciência da coordenação de área."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modalidade_display = serializers.CharField(source="get_modalidade_display", read_only=True)
    projeto_titulo = serializers.CharField(source="projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="edital.ano_codigo", read_only=True)
    prazo_relatorio = serializers.DateField(source="edital.data_entrega_relatorios", read_only=True)
    prazo_relatorio_encerrado = serializers.SerializerMethodField()
    finalizada_por_nome = serializers.CharField(
        source="finalizada_por.nome", read_only=True, default=""
    )
    bolsistas = serializers.SerializerMethodField()
    motivos_bloqueio = serializers.SerializerMethodField()
    pode_finalizar = serializers.SerializerMethodField()

    # Vigência efetiva: a da bolsa (exceção) ou a do edital.
    data_inicio_vigencia = serializers.DateField(source="inicio_vigencia", read_only=True)
    data_fim_vigencia = serializers.DateField(source="fim_vigencia", read_only=True)

    class Meta:
        model = Bolsa
        fields = [
            "id",
            "status",
            "status_display",
            "tipo_display",
            "modalidade_display",
            "carga_horaria_semanal",
            "projeto_titulo",
            "edital_nome",
            "edital_ano_codigo",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "prazo_relatorio",
            "prazo_relatorio_encerrado",
            "finalizada_em",
            "finalizada_por_nome",
            "ciencia_finalizacao_em",
            "bolsistas",
            "motivos_bloqueio",
            "pode_finalizar",
        ]

    def get_prazo_relatorio_encerrado(self, bolsa):
        return prazo_relatorio_encerrado(bolsa)

    def get_bolsistas(self, bolsa):
        ativos = [v for v in bolsa.vinculos.all() if v.status == StatusVinculo.ATIVO]
        return VinculoDoCoordenadorSerializer(ativos, many=True, context=self.context).data

    def get_motivos_bloqueio(self, bolsa):
        if bolsa.status == StatusBolsa.ENCERRADA:
            return []
        return motivos_bloqueio_finalizacao(bolsa)

    def get_pode_finalizar(self, bolsa):
        return bolsa.status != StatusBolsa.ENCERRADA and not self.get_motivos_bloqueio(bolsa)
