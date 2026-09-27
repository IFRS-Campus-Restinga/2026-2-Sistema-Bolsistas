from django.urls import path

from .views import (
    ArquivoEmentaProjetoView,
    DesligarProjetoView,
    ProjetoDetailView,
    ProjetoListCreateView,
)

app_name = "projetos"

urlpatterns = [
    path("", ProjetoListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/", ProjetoDetailView.as_view(), name="detalhe"),
    path("<int:pk>/arquivo/", ArquivoEmentaProjetoView.as_view(), name="arquivo"),
    path("<int:pk>/desligar/", DesligarProjetoView.as_view(), name="desligar"),
]
