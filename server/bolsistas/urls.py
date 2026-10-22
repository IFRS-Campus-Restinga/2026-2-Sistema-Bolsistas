from django.urls import path

from .views import (
    BolsasParaFinalizarView,
    BolsistasDoCoordenadorView,
    MeusVinculosView,
    ParecerRelatorioView,
    RelatorioFinalArquivoView,
    RelatorioFinalView,
    SolicitarRelatorioView,
)

app_name = "bolsistas"

urlpatterns = [
    path("meus-vinculos/", MeusVinculosView.as_view(), name="meus-vinculos"),
    path("vinculos/", BolsistasDoCoordenadorView.as_view(), name="vinculos"),
    path("bolsas/", BolsasParaFinalizarView.as_view(), name="bolsas-para-finalizar"),
    path(
        "vinculos/<int:pk>/solicitar-relatorio/",
        SolicitarRelatorioView.as_view(),
        name="solicitar-relatorio",
    ),
    path(
        "vinculos/<int:pk>/relatorio-final/",
        RelatorioFinalView.as_view(),
        name="relatorio-final",
    ),
    path(
        "vinculos/<int:pk>/relatorio-final/arquivo/",
        RelatorioFinalArquivoView.as_view(),
        name="relatorio-final-arquivo",
    ),
    path("vinculos/<int:pk>/parecer/", ParecerRelatorioView.as_view(), name="parecer"),
]
