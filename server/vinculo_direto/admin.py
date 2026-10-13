from django.contrib import admin

from .models import ConviteVinculoDireto, NotificacaoConvite


@admin.register(ConviteVinculoDireto)
class ConviteVinculoDiretoAdmin(admin.ModelAdmin):
    list_display = ["id", "aluno", "bolsa", "status", "data_envio_convite"]
    list_filter = ["status"]


@admin.register(NotificacaoConvite)
class NotificacaoConviteAdmin(admin.ModelAdmin):
    list_display = ["id", "coordenador_area", "convite", "criada_em", "lida_em"]
    list_filter = ["lida_em"]
