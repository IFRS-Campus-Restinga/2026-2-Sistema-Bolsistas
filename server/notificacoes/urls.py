from django.urls import path

from .views import LerNotificacaoView, LerTodasNotificacoesView, MinhasNotificacoesView

app_name = "notificacoes"

urlpatterns = [
    path("", MinhasNotificacoesView.as_view(), name="lista"),
    path("ler-todas/", LerTodasNotificacoesView.as_view(), name="ler-todas"),
    path("<int:pk>/ler/", LerNotificacaoView.as_view(), name="ler"),
]
