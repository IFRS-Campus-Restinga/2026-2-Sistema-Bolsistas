from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAdministrador

from .models import Notificacao, PreferenciasPendencias
from .serializers import NotificacaoSerializer, PreferenciasPendenciasSerializer

LIMITE_LISTAGEM = 50


class MinhasNotificacoesView(APIView):
    """Notificações do usuário logado, mais recentes primeiro. `?nao_lidas=1` filtra as não lidas.

    `configuravel` indica se o usuário tem a aba de configuração dos avisos de pendências.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        notificacoes = Notificacao.objects.filter(destinatario=request.user)
        nao_lidas = notificacoes.filter(lida_em__isnull=True)
        if request.query_params.get("nao_lidas", "").lower() in ("1", "true"):
            notificacoes = nao_lidas

        return Response(
            {
                "nao_lidas": nao_lidas.count(),
                "configuravel": request.user.role == Usuario.Role.ADMINISTRADOR,
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


class PreferenciasPendenciasView(APIView):
    """Prazos de inatividade que geram avisos de pendência para o administrador logado."""

    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        preferencias = PreferenciasPendencias.de(request.user)
        return Response(PreferenciasPendenciasSerializer(preferencias).data)

    def put(self, request):
        serializer = PreferenciasPendenciasSerializer(
            PreferenciasPendencias.de(request.user), data=request.data
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(usuario=request.user)
        return Response(serializer.data)
