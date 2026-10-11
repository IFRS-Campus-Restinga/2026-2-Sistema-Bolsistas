from django.contrib import admin

from .models import Bolsa, EditalValorBolsa, EtapaAvaliacao, TipoBolsaModalidade


class EtapaAvaliacaoInline(admin.TabularInline):
    model = EtapaAvaliacao
    extra = 0


@admin.register(Bolsa)
class BolsaAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "projeto",
        "tipo",
        "modalidade",
        "carga_horaria_semanal",
        "quantidade_vagas",
        "status",
    ]
    list_filter = ["status", "tipo", "modalidade"]
    inlines = [EtapaAvaliacaoInline]


@admin.register(TipoBolsaModalidade)
class TipoBolsaModalidadeAdmin(admin.ModelAdmin):
    list_display = ["id", "modalidade", "carga_horaria_semanal", "valor_maximo"]


@admin.register(EditalValorBolsa)
class EditalValorBolsaAdmin(admin.ModelAdmin):
    list_display = ["id", "edital", "tipo_bolsa_modalidade", "valor_mensal"]
    list_filter = ["edital"]
