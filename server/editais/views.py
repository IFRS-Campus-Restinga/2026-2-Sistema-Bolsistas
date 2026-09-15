from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsCoordenadorArea

from .models import Edital
from .serializers import CronogramaEditalSerializer, EditalSerializer


class EditalListCreateView(generics.ListCreateAPIView):
    queryset = Edital.objects.order_by("-id")
    serializer_class = EditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]


class EditalCronogramaUpdateView(generics.UpdateAPIView):
    queryset = Edital.objects.all()
    serializer_class = CronogramaEditalSerializer
    permission_classes = [IsAuthenticated, IsCoordenadorArea]
    http_method_names = ["patch", "options"]
