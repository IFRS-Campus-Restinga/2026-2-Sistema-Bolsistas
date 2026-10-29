from django.urls import path

from .views import MonitoramentoGlobalView, PainelAdministrativoView

app_name = "monitoramento"

urlpatterns = [
    path("", MonitoramentoGlobalView.as_view(), name="global"),
    path("painel/", PainelAdministrativoView.as_view(), name="painel"),
]
