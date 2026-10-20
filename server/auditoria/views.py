from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from accounts.permissions import IsAdministrador

from .models import LogAuditoria
from .serializers import LogAuditoriaSerializer


class PaginacaoAuditoria(PageNumberPagination):
    page_size = 20
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 100


class LogAuditoriaListView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrador]

    def get(self, request):
        inicio_texto = request.query_params.get("inicio")
        fim_texto = request.query_params.get("fim")

        inicio = parse_date(inicio_texto) if inicio_texto else None
        fim = parse_date(fim_texto) if fim_texto else None

        if inicio_texto and inicio is None:
            raise ValidationError({"inicio": "Informe a data inicial no formato AAAA-MM-DD."})

        if fim_texto and fim is None:
            raise ValidationError({"fim": "Informe a data final no formato AAAA-MM-DD."})

        if inicio and fim and inicio > fim:
            raise ValidationError({"detail": "A data inicial não pode ser posterior à data final."})

        logs = LogAuditoria.objects.select_related("usuario")

        if inicio:
            logs = logs.filter(data_hora__date__gte=inicio)

        if fim:
            logs = logs.filter(data_hora__date__lte=fim)

        paginador = PaginacaoAuditoria()
        pagina = paginador.paginate_queryset(logs, request, view=self)
        serializer = LogAuditoriaSerializer(pagina, many=True)
        return paginador.get_paginated_response(serializer.data)
