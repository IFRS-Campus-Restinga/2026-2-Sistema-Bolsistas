from django.contrib import admin

from .models import Notificacao, PreferenciasPendencias


@admin.register(Notificacao)
class NotificacaoAdmin(admin.ModelAdmin):
    list_display = ["id", "destinatario", "tom", "titulo", "criada_em", "lida_em"]
    list_filter = ["tom", "lida_em"]
    search_fields = ["titulo", "mensagem", "destinatario__nome", "destinatario__email"]


@admin.register(PreferenciasPendencias)
class PreferenciasPendenciasAdmin(admin.ModelAdmin):
    list_display = [
        "usuario",
        "avisar_solicitacao_parada",
        "dias_solicitacao_parada",
        "avisar_recurso_parado",
        "dias_recurso_parado",
    ]
