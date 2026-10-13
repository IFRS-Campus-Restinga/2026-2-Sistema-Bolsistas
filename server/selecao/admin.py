from django.contrib import admin

from .models import (
    DesempateClassificacao,
    DesistenciaVaga,
    IndicacaoBolsista,
    NotaEtapa,
    PublicacaoResultado,
    ResultadoInscricao,
)


@admin.register(NotaEtapa)
class NotaEtapaAdmin(admin.ModelAdmin):
    list_display = ["id", "inscricao", "etapa", "nota", "atualizada_em"]


@admin.register(DesempateClassificacao)
class DesempateClassificacaoAdmin(admin.ModelAdmin):
    list_display = ["id", "inscricao", "ordem"]


@admin.register(DesistenciaVaga)
class DesistenciaVagaAdmin(admin.ModelAdmin):
    list_display = ["id", "bolsa", "inscricao", "registrada_em"]


class ResultadoInscricaoInline(admin.TabularInline):
    model = ResultadoInscricao
    extra = 0


@admin.register(PublicacaoResultado)
class PublicacaoResultadoAdmin(admin.ModelAdmin):
    list_display = ["id", "bolsa", "publicado_em", "responsavel"]
    inlines = [ResultadoInscricaoInline]


@admin.register(IndicacaoBolsista)
class IndicacaoBolsistaAdmin(admin.ModelAdmin):
    list_display = ["id", "bolsa", "inscricao", "indicado_em"]
