from django.urls import path

from .views import BolsaDetailView, BolsaListCreateView

app_name = "bolsas"

urlpatterns = [
    path("", BolsaListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/", BolsaDetailView.as_view(), name="detalhe"),
]