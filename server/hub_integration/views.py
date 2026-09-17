from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def whoami(request):
    # identifica o usuário logado e seu papel
    user = request.user
    perfil = {}
    if user.role == user.Role.COORDENADOR_AREA:
        perfil["tipo_area"] = user.perfil_coordenador_area.tipo_area

    return Response(
        {
            "id": str(user.id),
            "email": user.email,
            "nome": user.nome,
            "role": user.role,
            **perfil,
        }
    )
