from django.urls import path

from .views import EditalCronogramaUpdateView, EditalListCreateView

app_name = "editais"

urlpatterns = [
    path("", EditalListCreateView.as_view(), name="lista-criacao"),
    path("<int:pk>/cronograma/", EditalCronogramaUpdateView.as_view(), name="cronograma"),
]
