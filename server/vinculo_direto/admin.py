from django.contrib import admin

from .models import ConviteVinculoDireto


@admin.register(ConviteVinculoDireto)
class ConviteVinculoDiretoAdmin(admin.ModelAdmin):
    list_display = ["id", "aluno", "bolsa", "status", "data_envio_convite"]
    list_filter = ["status"]
