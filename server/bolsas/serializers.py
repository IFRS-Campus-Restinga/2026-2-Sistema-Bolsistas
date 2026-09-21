from rest_framework import serializers

from editais.models import Edital
from projetos.models import StatusProjeto

from .models import Bolsa


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
            "tipo",
            "tipo_display",
            "modalidade",
            "modalidade_display",
            "carga_horaria_semanal",
            "valor_mensal",
            "prerequisitos",
            "metodologia_avaliacao",
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
        ]

    def get_minha_inscricao_status(self, bolsa):
        # Pra o Aluno saber, ao ver o detalhe da bolsa, se já tem inscrição
        # (rascunho ou pendente) antes de tentar se inscrever de novo.
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return None
        inscricao = bolsa.inscricoes.filter(aluno=request.user).exclude(status="CANCELADA").first()
        return inscricao.status if inscricao else None

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
