from django.urls import path

from .views import MonitoramentoGlobalView

app_name = "monitoramento"

urlpatterns = [
    path("", MonitoramentoGlobalView.as_view(), name="global"),
]
