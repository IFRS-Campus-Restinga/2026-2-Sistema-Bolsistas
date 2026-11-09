from django.urls import path

from .views import (
    CronogramaConsolidadoView,
    EditalCronogramaUpdateView,
    EditalDetailView,
    EditalListCreateView,
    EncerrarEditalView,
    HistoricoCronogramaView,
    PublicarEditalView,
    ValoresBolsaEditalView,
)

app_name = "editais"

urlpatterns = [
    path("", EditalListCreateView.as_view(), name="lista-criacao"),
    path("cronograma/", CronogramaConsolidadoView.as_view(), name="cronograma-consolidado"),
    path(
        "historico-cronograma/",
        HistoricoCronogramaView.as_view(),
        name="historico-cronograma",
    ),
    path("<int:pk>/cronograma/", EditalCronogramaUpdateView.as_view(), name="cronograma"),
    path("<int:pk>/", EditalDetailView.as_view(), name="detalhe"),
    path("<int:pk>/publicar/", PublicarEditalView.as_view(), name="publicar"),
    path("<int:pk>/encerrar/", EncerrarEditalView.as_view(), name="encerrar"),
    path("<int:pk>/valores-bolsa/", ValoresBolsaEditalView.as_view(), name="valores-bolsa"),
]
