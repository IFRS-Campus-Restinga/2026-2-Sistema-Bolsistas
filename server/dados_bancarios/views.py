from pathlib import Path

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Usuario
from accounts.permissions import IsAdministrador, IsAluno, IsCoordenadorProjeto

from .models import DadosBancarios
from .serializers import DadosBancariosSerializer


def dados_bancarios_acessiveis(usuario):
    dados = DadosBancarios.objects.select_related("aluno__usuario")

    if usuario.role == Usuario.Role.ALUNO:
        return dados.filter(aluno__usuario=usuario)

    if usuario.role == Usuario.Role.ADMINISTRADOR:
        return dados

    if usuario.role == Usuario.Role.COORDENADOR_PROJETO:
        return dados.filter(
            aluno__usuario__inscricoes__bolsa__projeto__coordenador_projeto__usuario=usuario,
            aluno__usuario__inscricoes__data_envio__isnull=False,
        ).distinct()

    return dados.none()


class MeusDadosBancariosView(APIView):
    permission_classes = [IsAuthenticated, IsAluno]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        dados = DadosBancarios.objects.filter(
            aluno__usuario=request.user,
        ).first()

        if dados is None:
            aluno = request.user.perfil_aluno

            return Response(
                {
                    "id": None,
                    "aluno_id": request.user.id,
                    "aluno_nome": request.user.nome,
                    "matricula": aluno.matricula or "",
                    "curso": aluno.curso,
                    "cpf": aluno.cpf or "",
                    "banco": "",
                    "agencia": "",
                    "conta": "",
                    "comprovante_url": None,
                    "cadastro_completo": False,
                }
            )

        serializer = DadosBancariosSerializer(
            dados,
            context={"request": request},
        )
        return Response(serializer.data)

    def put(self, request):
        dados = DadosBancarios.objects.filter(
            aluno__usuario=request.user,
        ).first()
        criado = dados is None

        serializer = DadosBancariosSerializer(
            dados,
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(aluno=request.user.perfil_aluno)

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if criado else status.HTTP_200_OK,
        )


class DadosBancariosAlunoView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsCoordenadorProjeto | IsAdministrador,
    ]

    def get(self, request, aluno_id):
        dados = get_object_or_404(
            dados_bancarios_acessiveis(request.user),
            aluno__usuario_id=aluno_id,
        )
        serializer = DadosBancariosSerializer(
            dados,
            context={"request": request},
        )
        return Response(serializer.data)


class ComprovanteBancarioView(APIView):
    permission_classes = [
        IsAuthenticated,
        IsAluno | IsCoordenadorProjeto | IsAdministrador,
    ]

    def get(self, request, pk):
        dados = get_object_or_404(
            dados_bancarios_acessiveis(request.user),
            pk=pk,
        )

        if not dados.comprovante:
            raise Http404("Comprovante bancário não encontrado.")

        try:
            arquivo = dados.comprovante.open("rb")
        except (FileNotFoundError, OSError, ValueError):
            raise Http404("Arquivo não encontrado.") from None

        return FileResponse(
            arquivo,
            as_attachment=True,
            filename=Path(dados.comprovante.name).name,
        )
