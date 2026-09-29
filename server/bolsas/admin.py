from django.contrib import admin

from .models import Bolsa, EtapaAvaliacao


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
