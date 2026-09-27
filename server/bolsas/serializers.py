from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from editais.models import Edital
from projetos.models import StatusProjeto

from .models import PESO_TOTAL, Bolsa, EtapaAvaliacao, StatusBolsa


def _decimal_str(valor):
    return None if valor is None else f"{valor:.2f}"


class BolsaSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modalidade_display = serializers.CharField(source="get_modalidade_display", read_only=True)
    edital_nome = serializers.CharField(source="edital.nome", read_only=True)
    edital_link_documento_oficial = serializers.URLField(
        source="edital.link_documento_oficial", read_only=True
    )
    projeto_titulo = serializers.CharField(source="projeto.titulo", read_only=True)
    minha_inscricao_status = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()
    pode_editar_etapas = serializers.SerializerMethodField()

    projeto_arquivo_ementa = serializers.FileField(source="projeto.arquivo_ementa", read_only=True)
    projeto_nome_arquivo = serializers.CharField(
        source="projeto.nome_original_arquivo", read_only=True
    )
    etapas = serializers.SerializerMethodField()
    aviso_pesos = serializers.SerializerMethodField()

    class Meta:
        model = Bolsa
        fields = [
            "id",
            "projeto",
            "projeto_titulo",
            "edital",
            "edital_nome",
            "edital_link_documento_oficial",
            "minha_inscricao_status",
            "pode_editar",
            "pode_editar_etapas",
            "tipo",
            "tipo_display",
            "modalidade",
            "modalidade_display",
            "carga_horaria_semanal",
            "valor_mensal",
            "quantidade_vagas",
            "prerequisitos",
            "metodologia_avaliacao",
            "projeto_arquivo_ementa",
            "projeto_nome_arquivo",
            "etapas",
            "aviso_pesos",
            "nota_minima",
            "data_inicio_vigencia",
            "data_fim_vigencia",
            "status",
            "status_display",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
            "coordenador_area",
        ]
        read_only_fields = [
            "id",
            "status",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
            "coordenador_area",
            "edital_data_maxima_preenchimento_vagas",
        ]

    def get_minha_inscricao_status(self, bolsa):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        inscricao = bolsa.inscricoes.filter(aluno=request.user).exclude(status="CANCELADA").first()
        return inscricao.status if inscricao else None

    def get_pode_editar(self, bolsa):
        return not bolsa.motivo_bloqueio_edicao()

    def get_pode_editar_etapas(self, bolsa):
        return not bolsa.motivo_bloqueio_etapas()

    def get_etapas(self, bolsa):
        efetivos = bolsa.pesos_efetivos_etapas()
        return [
            {
                "id": etapa.id,
                "nome": etapa.nome,
                # string, igual aos outros DecimalField do DRF
                "peso": _decimal_str(etapa.peso),
                "peso_efetivo": _decimal_str(efetivos[etapa.id]),
                "data_hora": serializers.DateTimeField().to_representation(etapa.data_hora)
                if etapa.data_hora
                else None,
                "local": etapa.local,
            }
            for etapa in bolsa.etapas.all()
        ]

    def get_aviso_pesos(self, bolsa):
        return bolsa.aviso_pesos_etapas()

    def validate_projeto(self, projeto):
        request = self.context["request"]
        if projeto.coordenador_projeto.usuario_id != request.user.id:
            raise serializers.ValidationError("Você não é o coordenador deste projeto.")
        if projeto.status != StatusProjeto.ATIVO:
            raise serializers.ValidationError(
                "Não é possível solicitar bolsa para um projeto desligado."
            )
        return projeto

    def validate_edital(self, edital):
        if edital.status != Edital.Status.EM_VIGOR:
            raise serializers.ValidationError(
                "Só é possível solicitar bolsa para um edital em vigor."
            )
        return edital


class BolsaEdicaoSerializer(BolsaSerializer):
    class Meta(BolsaSerializer.Meta):
        read_only_fields = [*BolsaSerializer.Meta.read_only_fields, "projeto", "edital"]

    def validate_tipo(self, tipo):
        bolsa = self.instance
        if tipo != bolsa.tipo and bolsa.status != StatusBolsa.SOLICITADA:
            raise serializers.ValidationError(
                "O tipo não pode ser alterado depois que a bolsa foi aprovada."
            )
        return tipo


class EtapaAvaliacaoSerializer(serializers.ModelSerializer):
    """CRUD de etapa. A bolsa vem da URL (context["bolsa"]), não do corpo."""

    peso = serializers.DecimalField(
        max_digits=5, decimal_places=2, allow_null=True, required=False, default=None
    )

    class Meta:
        model = EtapaAvaliacao
        fields = ["id", "bolsa", "nome", "peso", "data_hora", "local"]
        read_only_fields = ["id", "bolsa"]

    def _bolsa(self):
        return self.instance.bolsa if self.instance else self.context["bolsa"]

    def _outras_etapas(self):
        etapas = self._bolsa().etapas.all()
        return etapas.exclude(pk=self.instance.pk) if self.instance else etapas

    def validate_nome(self, nome):
        nome = nome.strip()
        if not nome:
            raise serializers.ValidationError("Informe o nome da etapa.")
        if self._outras_etapas().filter(nome__iexact=nome).exists():
            raise serializers.ValidationError("Já existe uma etapa com esse nome nesta bolsa.")
        return nome

    def validate_data_hora(self, data_hora):
        if data_hora is None:
            return data_hora
        if self.instance and self.instance.data_hora == data_hora:
            return data_hora
        if data_hora < timezone.now():
            raise serializers.ValidationError("A data e hora da etapa não pode estar no passado.")
        return data_hora

    def validate_local(self, local):
        return local.strip()

    def validate_peso(self, peso):
        if peso is None:
            return peso
        if peso <= 0 or peso > PESO_TOTAL:
            raise serializers.ValidationError("O peso deve ser maior que 0% e no máximo 100%.")
        soma_outras = sum(
            (e.peso for e in self._outras_etapas() if e.peso is not None), Decimal("0")
        )
        if soma_outras + peso > PESO_TOTAL:
            disponivel = PESO_TOTAL - soma_outras
            raise serializers.ValidationError(
                f"A soma dos pesos passaria de 100%. As outras etapas já somam {soma_outras}%; "
                f"o máximo para esta etapa é {disponivel}%."
            )
        return peso
