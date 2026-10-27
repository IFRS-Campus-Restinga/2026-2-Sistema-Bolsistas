from django.contrib import admin

from .models import Frequencia, SolicitacaoFrequencia


@admin.register(Frequencia)
class FrequenciaAdmin(admin.ModelAdmin):
    list_display = ["vinculo", "mes_referencia", "registrada", "fora_do_prazo", "status_pagamento"]
    list_filter = ["registrada", "fora_do_prazo", "status_pagamento"]
    search_fields = ["vinculo__aluno__nome", "vinculo__bolsa__projeto__titulo"]


@admin.register(SolicitacaoFrequencia)
class SolicitacaoFrequenciaAdmin(admin.ModelAdmin):
    list_display = ["vinculo", "mes_referencia", "solicitante", "criada_em", "atendida_em"]
    list_filter = ["atendida_em"]
