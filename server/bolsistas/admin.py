from django.contrib import admin

from .models import RelatorioFinal, VinculoBolsista


@admin.register(VinculoBolsista)
class VinculoBolsistaAdmin(admin.ModelAdmin):
    list_display = ["aluno", "bolsa", "origem", "criado_em"]
    list_filter = ["origem"]
    search_fields = ["aluno__nome", "aluno__email", "bolsa__projeto__titulo"]


@admin.register(RelatorioFinal)
class RelatorioFinalAdmin(admin.ModelAdmin):
    list_display = ["vinculo", "situacao", "enviado_em", "avaliado_por", "avaliado_em"]
    list_filter = ["situacao"]
