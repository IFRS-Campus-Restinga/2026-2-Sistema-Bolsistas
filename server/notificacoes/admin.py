from django.contrib import admin

from .models import Notificacao


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ["id", "destinatario", "tom", "titulo", "criada_em", "lida_em"]
    list_filter = ["tom", "lida_em"]
    search_fields = ["titulo", "mensagem", "destinatario__nome", "destinatario__email"]
