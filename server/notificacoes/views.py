from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario

from .models import Notificacao
from .pendencias import verificar_pendencias
from .serializers import NotificacaoSerializer

LIMITE_LISTAGEM = 50


class MinhasNotificacoesView(APIView):
    """Notificações do usuário logado, mais recentes primeiro. `?nao_lidas=1` filtra as não lidas."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role == Usuario.Role.ADMINISTRADOR:
            verificar_pendencias()

        notificacoes = Notificacao.objects.filter(destinatario=request.user)
        nao_lidas = notificacoes.filter(lida_em__isnull=True)
        if request.query_params.get("nao_lidas", "").lower() in ("1", "true"):
            notificacoes = nao_lidas

        return Response(
            {
                "nao_lidas": nao_lidas.count(),
                "resultados": NotificacaoSerializer(notificacoes[:LIMITE_LISTAGEM], many=True).data,
            }
        )


class LerNotificacaoView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notificacao = get_object_or_404(Notificacao, pk=pk, destinatario=request.user)
        if notificacao.lida_em is None:
            notificacao.lida_em = timezone.now()
            notificacao.save(update_fields=["lida_em"])
        return Response(NotificacaoSerializer(notificacao).data)


class LerTodasNotificacoesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        atualizadas = Notificacao.objects.filter(
            destinatario=request.user, lida_em__isnull=True
        ).update(lida_em=timezone.now())
        return Response({"atualizadas": atualizadas})
