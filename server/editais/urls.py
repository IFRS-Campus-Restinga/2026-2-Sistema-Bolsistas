from django.urls import path

from .views import (
    EditalCronogramaUpdateView,
    EditalDetailView,
    EditalListCreateView,
    EncerrarEditalView,
    PublicarEditalView,
)

app_name = "editais"

urlpatterns = [
    path("", EditalListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/cronograma/", EditalCronogramaUpdateView.as_view(), name="cronograma"),
    path("<int:pk>/", EditalDetailView.as_view(), name="detalhe"),
    path("<int:pk>/publicar/", PublicarEditalView.as_view(), name="publicar"),
    path("<int:pk>/encerrar/", EncerrarEditalView.as_view(), name="encerrar"),
]
