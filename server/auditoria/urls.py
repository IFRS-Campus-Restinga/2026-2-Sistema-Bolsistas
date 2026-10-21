from django.urls import path

from .views import LogAuditoriaListView, OpcoesAuditoriaView

app_name = "auditoria"

urlpatterns = [
    path("logs/", LogAuditoriaListView.as_view(), name="logs"),
    path("opcoes/", OpcoesAuditoriaView.as_view(), name="opcoes"),
]
