from decimal import Decimal

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import serializers

from editais.models import Edital
from inscricoes.models import StatusInscricao
from projetos.models import StatusProjeto

from .models import PESO_TOTAL, Bolsa, EditalValorBolsa, EtapaAvaliacao, StatusBolsa


def valor_da_tabela(edital, modalidade, carga_horaria):
    valor = EditalValorBolsa.objects.filter(
        edital=edital,
        tipo_bolsa_modalidade__modalidade=modalidade,
        tipo_bolsa_modalidade__carga_horaria_semanal=carga_horaria,
    ).first()
    return valor.valor_mensal if valor else None


def _decimal_str(valor):
    return None if valor is None else f"{valor:.2f}"


# Rascunho ainda não foi enviado e cancelada saiu da seleção: não contam como inscritos.
STATUS_FORA_DA_SELECAO = [StatusInscricao.RASCUNHO, StatusInscricao.CANCELADA]


def com_contagem_de_inscricoes(queryset):
    return queryset.annotate(
        total_inscritos=Count(
            "inscricoes", filter=~Q(inscricoes__status__in=STATUS_FORA_DA_SELECAO), distinct=True
        ),
        inscricoes_pendentes=Count(
            "inscricoes", filter=Q(inscricoes__status=StatusInscricao.PENDENTE), distinct=True
        ),
    )


class BolsaSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    modalidade_display = serializers.CharField(source="get_modalidade_display", read_only=True)
    # Vigência efetiva: a da bolsa (exceção) ou a do edital.
    inicio_vigencia = serializers.DateField(read_only=True)
    fim_vigencia = serializers.DateField(read_only=True)
    edital_nome = serializers.CharField(source="edital.nome", read_only=True)
    edital_ano_codigo = serializers.CharField(source="edital.ano_codigo", read_only=True)
    total_inscritos = serializers.SerializerMethodField()
    inscricoes_pendentes = serializers.SerializerMethodField()
    edital_link_documento_oficial = serializers.URLField(
        source="edital.link_documento_oficial", read_only=True
    )
    projeto_titulo = serializers.CharField(source="projeto.titulo", read_only=True)
    minha_inscricao_status = serializers.SerializerMethodField()
    pode_editar = serializers.SerializerMethodField()
    pode_editar_etapas = serializers.SerializerMethodField()
    # Motivos de bloqueio (vazio quando pode), mostrados no painel da bolsa.
    motivo_bloqueio_edicao = serializers.SerializerMethodField()
    motivo_bloqueio_etapas = serializers.SerializerMethodField()
    edital_fechamento_inscricoes = serializers.DateField(
        source="edital.data_fechamento_inscricoes", read_only=True
    )

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
            "edital_ano_codigo",
            "edital_link_documento_oficial",
            "total_inscritos",
            "inscricoes_pendentes",
            "minha_inscricao_status",
            "pode_editar",
            "pode_editar_etapas",
            "motivo_bloqueio_edicao",
            "motivo_bloqueio_etapas",
            "edital_fechamento_inscricoes",
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
            "inicio_vigencia",
            "fim_vigencia",
            "status",
            "status_display",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
            "coordenador_area",
        ]
        read_only_fields = [
            "id",
            "valor_mensal",
            "status",
            "data_solicitacao",
            "data_decisao",
            "justificativa_decisao",
            "coordenador_area",
        ]

    # Na lista vêm anotados (com_contagem_de_inscricoes); fora dela, conta direto.
    def get_total_inscritos(self, bolsa):
        total = getattr(bolsa, "total_inscritos", None)
        if total is None:
            total = bolsa.inscricoes.exclude(status__in=STATUS_FORA_DA_SELECAO).count()
        return total

    def get_inscricoes_pendentes(self, bolsa):
        total = getattr(bolsa, "inscricoes_pendentes", None)
        if total is None:
            total = bolsa.inscricoes.filter(status=StatusInscricao.PENDENTE).count()
        return total

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

    def get_motivo_bloqueio_edicao(self, bolsa):
        return bolsa.motivo_bloqueio_edicao() or ""

    def get_motivo_bloqueio_etapas(self, bolsa):
        return bolsa.motivo_bloqueio_etapas() or ""

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

    def validate(self, attrs):
        attrs = super().validate(attrs)
        bolsa = self.instance
        edital = attrs.get("edital", getattr(bolsa, "edital", None))
        modalidade = attrs.get("modalidade", getattr(bolsa, "modalidade", None))
        carga_horaria = attrs.get(
            "carga_horaria_semanal", getattr(bolsa, "carga_horaria_semanal", None)
        )

        valor = valor_da_tabela(edital, modalidade, carga_horaria)
        if valor is not None:
            attrs["valor_mensal"] = valor
            return attrs

        combinacao_mudou = bolsa is None or (modalidade, carga_horaria) != (
            bolsa.modalidade,
            bolsa.carga_horaria_semanal,
        )
        if not combinacao_mudou:
            # Bolsa anterior à tabela de valores do edital: mantém o valor gravado.
            return attrs

        if not edital.valores_bolsa.exists():
            raise serializers.ValidationError(
                {
                    "modalidade": "Este edital ainda não tem modalidades e valores de bolsa "
                    "configurados pelo Coordenador de Área."
                }
            )
        raise serializers.ValidationError(
            {
                "carga_horaria_semanal": f"A combinação {modalidade} com {carga_horaria}h "
                "semanais não está disponível neste edital."
            }
        )

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


class BolsaDisponivelSerializer(BolsaSerializer):
    """Bolsa vista pelo aluno em Bolsas disponíveis (US93): o card e o painel de detalhes.

    Datas relativas (dias até o fim das inscrições, fase atual) vêm calculadas do servidor.
    """

    coordenador_projeto_nome = serializers.CharField(
        source="projeto.coordenador_projeto.usuario.nome", read_only=True
    )
    projeto_ementa_html = serializers.CharField(source="projeto.ementa_html", read_only=True)
    dias_para_encerrar_inscricoes = serializers.SerializerMethodField()
    cronograma = serializers.SerializerMethodField()

    class Meta(BolsaSerializer.Meta):
        fields = [
            *BolsaSerializer.Meta.fields,
            "coordenador_projeto_nome",
            "projeto_ementa_html",
            "dias_para_encerrar_inscricoes",
            "cronograma",
        ]

    def get_dias_para_encerrar_inscricoes(self, bolsa):
        fechamento = bolsa.edital.data_fechamento_inscricoes
        return (fechamento - timezone.localdate()).days if fechamento else None

    def get_cronograma(self, bolsa):
        # A vigência pode ser própria da bolsa (exceção à do edital).
        return bolsa.edital.fases_do_cronograma(fim_vigencia=bolsa.fim_vigencia)


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
