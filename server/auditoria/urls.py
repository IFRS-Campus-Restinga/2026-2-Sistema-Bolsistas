from django.urls import path

from .views import ExportarLogsView, LogAuditoriaListView, OpcoesAuditoriaView

app_name = "auditoria"

urlpatterns = [
    path("logs/", LogAuditoriaListView.as_view(), name="logs"),
    path("logs/exportar/", ExportarLogsView.as_view(), name="exportar"),
    path("opcoes/", OpcoesAuditoriaView.as_view(), name="opcoes"),
]
