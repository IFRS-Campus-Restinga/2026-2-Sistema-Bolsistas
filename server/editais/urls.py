from django.urls import path

from .views import (
    ArquivarEditalView,
    CronogramaConsolidadoView,
    EditalCronogramaUpdateView,
    EditalDetailView,
    EditalListCreateView,
    EncerrarEditalView,
    PublicarEditalView,
)

app_name = "editais"

urlpatterns = [
    path("", EditalListCreateView.as_view(), name="lista-criacao"),
    # Rota específica antes de <int:pk>/ para não colidir
    path(
        "cronograma-consolidado/",
        CronogramaConsolidadoView.as_view(),
        name="cronograma-consolidado",
    ),
    path("<int:pk>/cronograma/", EditalCronogramaUpdateView.as_view(), name="cronograma"),
    path("<int:pk>/", EditalDetailView.as_view(), name="detalhe"),
    path("<int:pk>/publicar/", PublicarEditalView.as_view(), name="publicar"),
    path("<int:pk>/encerrar/", EncerrarEditalView.as_view(), name="encerrar"),
    path("<int:pk>/arquivar/", ArquivarEditalView.as_view(), name="arquivar"),
]
