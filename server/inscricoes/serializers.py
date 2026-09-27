from django.utils import timezone
from rest_framework import serializers

from bolsas.models import StatusBolsa

from .models import Documento, Inscricao, StatusInscricao

MAX_INSCRICOES_ATIVAS_POR_EDITAL = 3


class DocumentoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Documento
        fields = ["id", "tipo", "tipo_display", "nome_original", "arquivo", "enviado_em"]
        read_only_fields = ["id", "nome_original", "enviado_em"]


class InscricaoSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    bolsa_tipo_display = serializers.CharField(source="bolsa.get_tipo_display", read_only=True)
    projeto_titulo = serializers.CharField(source="bolsa.projeto.titulo", read_only=True)
    edital_nome = serializers.CharField(source="bolsa.edital.nome", read_only=True)
    documentos = DocumentoSerializer(many=True, read_only=True)

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
        ]
        read_only_fields = ["id", "status", "data_criacao", "data_envio", "data_cancelamento"]

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
