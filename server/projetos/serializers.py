import nh3
from rest_framework import serializers

from bolsas.models import StatusBolsa
from bolsistas.models import StatusVinculo
from server.validators import validar_upload

from .models import EXTENSOES_ARQUIVO_EMENTA, TAMANHO_MAX_ARQUIVO_EMENTA_MB, Projeto

# Bolsas que contam vagas no card do projeto: aprovadas pela área e não finalizadas.
STATUS_COM_VAGAS = [StatusBolsa.ABERTA, StatusBolsa.EM_SELECAO, StatusBolsa.PREENCHIDA]


class ProjetoSerializer(serializers.ModelSerializer):
    """Projeto com o resumo das bolsas usado nos cards de Meus projetos (US93).

    A view faz o prefetch de `bolsas__vinculos` para o resumo não gerar uma consulta por projeto.
    """

    tipos_bolsa = serializers.SerializerMethodField()
    bolsas_resumo = serializers.SerializerMethodField()
    vagas_total = serializers.SerializerMethodField()
    bolsistas_ativos = serializers.SerializerMethodField()

    class Meta:
        model = Projeto
        fields = [
            "id",
            "titulo",
            "descricao",
            "status",
            "coordenador_projeto",
            "arquivo_ementa",
            "nome_original_arquivo",
            "ementa_html",
            "criado_em",
            "tipos_bolsa",
            "bolsas_resumo",
            "vagas_total",
            "bolsistas_ativos",
        ]
        read_only_fields = [
            "id",
            "status",
            "coordenador_projeto",
            # upload/remoção do arquivo só pelo endpoint /projetos/<id>/arquivo/
            "arquivo_ementa",
            "nome_original_arquivo",
            # a ementa só é alterada pelo endpoint /projetos/<id>/ementa/
            "ementa_html",
            "criado_em",
        ]

    def _bolsas(self, projeto):
        return sorted(projeto.bolsas.all(), key=lambda bolsa: bolsa.id)

    def get_tipos_bolsa(self, projeto):
        tipos = {bolsa.tipo: bolsa.get_tipo_display() for bolsa in self._bolsas(projeto)}
        return sorted(tipos.values())

    def get_bolsas_resumo(self, projeto):
        return [
            {
                "id": bolsa.id,
                "modalidade": bolsa.modalidade,
                "carga_horaria_semanal": bolsa.carga_horaria_semanal,
                "status": bolsa.status,
            }
            for bolsa in self._bolsas(projeto)
        ]

    def get_vagas_total(self, projeto):
        return sum(
            bolsa.quantidade_vagas
            for bolsa in self._bolsas(projeto)
            if bolsa.status in STATUS_COM_VAGAS
        )

    def get_bolsistas_ativos(self, projeto):
        return sum(
            1
            for bolsa in self._bolsas(projeto)
            for vinculo in bolsa.vinculos.all()
            if vinculo.status == StatusVinculo.ATIVO
        )


# Tags que o editor da ementa produz (títulos, negrito, itálico, listas e citação).
TAGS_DA_EMENTA = {
    "h1",
    "h2",
    "p",
    "div",
    "br",
    "b",
    "strong",
    "i",
    "em",
    "ul",
    "ol",
    "li",
    "blockquote",
}
TAMANHO_MAX_EMENTA = 20000


def limpar_ementa(html):
    """Mantém só a formatação do editor; remove scripts, atributos e qualquer outra tag."""
    return nh3.clean(html, tags=TAGS_DA_EMENTA, attributes={}).strip()


class EmentaProjetoSerializer(serializers.Serializer):
    ementa_html = serializers.CharField(
        allow_blank=True, max_length=TAMANHO_MAX_EMENTA, trim_whitespace=False
    )

    def validate_ementa_html(self, html):
        limpo = limpar_ementa(html)
        # O editor deixa "<br>" ou "<div><br></div>" quando o texto é apagado.
        if not nh3.clean(limpo, tags=set()).strip():
            return ""
        return limpo


class ArquivoEmentaSerializer(serializers.Serializer):
    arquivo = serializers.FileField()

    def validate_arquivo(self, arquivo):
        return validar_upload(arquivo, EXTENSOES_ARQUIVO_EMENTA, TAMANHO_MAX_ARQUIVO_EMENTA_MB)
