from django.urls import path

from .views import (
    LerNotificacaoView,
    LerTodasNotificacoesView,
    MinhasNotificacoesView,
    PreferenciasPendenciasView,
)

app_name = "notificacoes"

urlpatterns = [
    path("", MinhasNotificacoesView.as_view(), name="lista"),
    path("ler-todas/", LerTodasNotificacoesView.as_view(), name="ler-todas"),
    path("preferencias/", PreferenciasPendenciasView.as_view(), name="preferencias"),
    path("<int:pk>/ler/", LerNotificacaoView.as_view(), name="ler"),
]
