import re

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import AlteracaoCronograma, Edital

ETAPAS = [
    ("data_abertura_inscricoes", "Abertura das inscrições"),
    ("data_fechamento_inscricoes", "Fechamento das inscrições"),
    ("data_homologacao", "Homologação"),
    ("data_recurso_homologacao_inicio", "Início dos recursos"),
    ("data_recurso_homologacao_fim", "Fim dos recursos"),
    ("data_resultado", "Resultado"),
    ("data_entrega_relatorios", "Entrega de relatórios"),
]

CAMPOS_CRONOGRAMA = [campo for campo, _ in ETAPAS]


def validar_cronograma(attrs, instance=None, obrigatorio=False):
    erros = {}
    hoje = timezone.localdate()
    data_anterior = None
    nome_anterior = None

    for campo, nome in ETAPAS:
        data = attrs.get(campo, getattr(instance, campo, None))

        if data is None:
            if obrigatorio:
                erros[campo] = "Esta data é obrigatória para um edital em vigor."
            continue

        # Bloquear datas no passado:
        # - Na criação e edição de RASCUNHO: qualquer data < hoje é recusada.
        # - Na edição de EM_VIGOR: só recusa se o campo foi efetivamente alterado.
        if data < hoje:
            em_vigor = instance is not None and instance.status == Edital.Status.EM_VIGOR
            if em_vigor:
                # Campo alterado → recusar; não-alterado (data antiga que já venceu) → permitir
                campo_alterado = campo in attrs and attrs[campo] != getattr(instance, campo, None)
                if campo_alterado:
                    erros[campo] = "Esta data não pode estar no passado."
            else:
                erros[campo] = "Esta data não pode estar no passado."

        if data_anterior is not None and data < data_anterior:
            erros[campo] = f"{nome} não pode ser anterior a {nome_anterior.lower()}."

        data_anterior = data
        nome_anterior = nome

    if erros:
        raise serializers.ValidationError(erros)


class EditalSerializer(serializers.ModelSerializer):
    prazo_inscricao_encerrado = serializers.SerializerMethodField()
    dia_limite_frequencia = serializers.IntegerField(
        min_value=1, max_value=31, allow_null=True, required=False
    )

    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_codigo",
            "link_documento_oficial",
            "status",
            "prazo_inscricao_encerrado",
            *CAMPOS_CRONOGRAMA,
            "dia_limite_frequencia",
        ]
        read_only_fields = ["id", "status"]

    def get_prazo_inscricao_encerrado(self, edital):
        if edital.data_fechamento_inscricoes is None:
            return False
        return timezone.localdate() > edital.data_fechamento_inscricoes

    def validate_ano_codigo(self, value):
        if not re.fullmatch(r"[0-9]{4}-[0-9]{3}", value):
            raise serializers.ValidationError(
                "Informe o ano/código no formato AAAA-NNN, como 2026-005."
            )
        return value

    def validate(self, attrs):
        if self.instance and self.instance.status == Edital.Status.ENCERRADO:
            raise serializers.ValidationError("Editais encerrados não podem ser editados.")

        em_vigor = self.instance is not None and self.instance.status == Edital.Status.EM_VIGOR

        validar_cronograma(
            attrs,
            instance=self.instance,
            obrigatorio=em_vigor,
        )
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        alteracoes = []

        if instance.status == Edital.Status.EM_VIGOR:
            for campo in CAMPOS_CRONOGRAMA:
                if campo not in validated_data:
                    continue

                anterior = getattr(instance, campo)
                nova = validated_data[campo]

                if anterior != nova:
                    alteracoes.append(
                        AlteracaoCronograma(
                            edital=instance,
                            campo=campo,
                            data_anterior=anterior,
                            data_nova=nova,
                            responsavel=self.context["request"].user,
                        )
                    )

        instance = super().update(instance, validated_data)
        AlteracaoCronograma.objects.bulk_create(alteracoes)

        return instance


class CronogramaEditalSerializer(EditalSerializer):
    class Meta:
        model = Edital
        fields = CAMPOS_CRONOGRAMA


class CronogramaConsolidadoSerializer(serializers.ModelSerializer):
    """Serializer enxuto para a listagem consolidada de editais (US19)."""

    status_display = serializers.CharField(source="get_status_display", read_only=True)
    proxima_etapa = serializers.SerializerMethodField()

    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_codigo",
            "status",
            "status_display",
            "proxima_etapa",
            *CAMPOS_CRONOGRAMA,
            "dia_limite_frequencia",
        ]

    def get_proxima_etapa(self, edital):
        """Retorna o nome e data da próxima etapa ainda não vencida."""
        hoje = timezone.localdate()
        for campo, nome in ETAPAS:
            data = getattr(edital, campo)
            if data and data >= hoje:
                return {"campo": campo, "nome": nome, "data": data}
        return None


class EditalDetalheSerializer(EditalSerializer):
    datas_originais = serializers.SerializerMethodField()
    historico_por_data = serializers.SerializerMethodField()

    def get_datas_originais(self, obj):
        resultado = {}
        for campo in CAMPOS_CRONOGRAMA:
            alteracao = obj.historico_cronograma.filter(campo=campo).order_by("id").first()
            resultado[campo] = alteracao.data_anterior if alteracao else None
        return resultado

    def get_historico_por_data(self, obj):
        """
        Retorna, para cada campo do cronograma, a lista ordenada de todas as
        prorrogações: {data_anterior, data_nova, responsavel, alterado_em}.
        """
        resultado = {}
        alteracoes = obj.historico_cronograma.select_related("responsavel").order_by(
            "campo", "alterado_em"
        )
        for campo in CAMPOS_CRONOGRAMA:
            resultado[campo] = [
                {
                    "data_anterior": alt.data_anterior.isoformat() if alt.data_anterior else None,
                    "data_nova": alt.data_nova.isoformat() if alt.data_nova else None,
                    "responsavel": alt.responsavel.get_full_name() or alt.responsavel.username
                    if alt.responsavel
                    else None,
                    "alterado_em": alt.alterado_em.isoformat(),
                }
                for alt in alteracoes
                if alt.campo == campo
            ]
        return resultado

    class Meta:
        model = Edital
        fields = [
            "id",
            "nome",
            "ano_codigo",
            "link_documento_oficial",
            "status",
            *CAMPOS_CRONOGRAMA,
            "dia_limite_frequencia",
            "datas_originais",
            "historico_por_data",
        ]
        read_only_fields = ["id", "status", "datas_originais", "historico_por_data"]
