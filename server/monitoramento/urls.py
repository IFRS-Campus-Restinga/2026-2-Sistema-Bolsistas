from django.urls import path

from .views import (
    ContadoresMenuView,
    MonitoramentoGlobalView,
    PainelAdministrativoView,
    PainelAlunoView,
    PainelAreaView,
    PainelCoordenadorProjetoView,
)

app_name = "monitoramento"

urlpatterns = [
    path("", MonitoramentoGlobalView.as_view(), name="global"),
    path("painel/", PainelAdministrativoView.as_view(), name="painel"),
    path("painel/area/", PainelAreaView.as_view(), name="painel-area"),
    path("painel/aluno/", PainelAlunoView.as_view(), name="painel-aluno"),
    path("painel/projeto/", PainelCoordenadorProjetoView.as_view(), name="painel-projeto"),
    path("contadores-menu/", ContadoresMenuView.as_view(), name="contadores-menu"),
]
