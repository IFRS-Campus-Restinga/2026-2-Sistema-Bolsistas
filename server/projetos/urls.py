from django.urls import path

from .views import DesligarProjetoView, ProjetoDetailView, ProjetoListCreateView

app_name = "projetos"

urlpatterns = [
    path("", ProjetoListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/", ProjetoDetailView.as_view(), name="detalhe"),
    path("<int:pk>/desligar/", DesligarProjetoView.as_view(), name="desligar"),
]
