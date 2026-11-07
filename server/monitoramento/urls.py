from django.urls import path

from .views import ContadoresMenuView, MonitoramentoGlobalView, PainelAdministrativoView

app_name = "monitoramento"

urlpatterns = [
    path("", MonitoramentoGlobalView.as_view(), name="global"),
    path("painel/", PainelAdministrativoView.as_view(), name="painel"),
    path("contadores-menu/", ContadoresMenuView.as_view(), name="contadores-menu"),
]
