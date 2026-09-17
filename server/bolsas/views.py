from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsCoordenadorProjeto

from .models import Bolsa
from .serializers import BolsaSerializer


class BolsaListCreateView(generics.ListCreateAPIView):

    serializer_class = BolsaSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        return Bolsa.objects.filter(solicitante=self.request.user)


class BolsaDetailView(generics.RetrieveAPIView):

    serializer_class = BolsaSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorProjeto]

    def get_queryset(self):
        return Bolsa.objects.filter(solicitante=self.request.user)