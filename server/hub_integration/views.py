from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import CoordenadorArea, CoordenadorProjeto, EmailCoordenadorArea, Usuario
from accounts.permissions import IsAdministrador
from accounts.serializers import (
    CoordenadorAreaTipoSerializer,
    EmailCoordenadorAreaSerializer,
    UsuarioListSerializer,
)


@api_view(["GET"])
def whoami(request):
    user = request.user
    perfil = {}
    if user.role == user.Role.COORDENADOR_AREA:
        perfil_obj = getattr(user, "perfil_coordenador_area", None)
        perfil["tipo_area"] = perfil_obj.tipo_area if perfil_obj else None

    return Response(
        {
            "id": str(user.id),
            "email": user.email,
            "nome": user.nome,
            "role": user.role,
            **perfil,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def listar_usuarios(request):
    usuarios = Usuario.objects.select_related("perfil_coordenador_area").all().order_by("nome")
    return Response(UsuarioListSerializer(usuarios, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdministrador])
def atualizar_tipo_area(request, usuario_id):
    usuario = get_object_or_404(Usuario, id=usuario_id, role=Usuario.Role.COORDENADOR_AREA)
    perfil = get_object_or_404(CoordenadorArea, usuario=usuario)
    serializer = CoordenadorAreaTipoSerializer(perfil, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    # Mantém EmailCoordenadorArea sincronizado para que o próximo login não reverta.
    if usuario.email:
        EmailCoordenadorArea.objects.filter(email__iexact=usuario.email).update(
            tipo_area=serializer.validated_data["tipo_area"]
        )

    usuario.refresh_from_db()
    return Response(UsuarioListSerializer(usuario).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdministrador])
def atualizar_status(request, usuario_id):
    usuario = get_object_or_404(Usuario, id=usuario_id)
    is_active = request.data.get("is_active")
    if is_active is None:
        return Response(
            {"is_active": ["Este campo é obrigatório."]}, status=status.HTTP_400_BAD_REQUEST
        )
    usuario.is_active = bool(is_active)
    usuario.save(update_fields=["is_active"])
    return Response(UsuarioListSerializer(usuario).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdministrador])
def emails_coordenadores(request):
    if request.method == "GET":
        entradas = EmailCoordenadorArea.objects.all().order_by("email")
        return Response(EmailCoordenadorAreaSerializer(entradas, many=True).data)

    serializer = EmailCoordenadorAreaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdministrador])
def email_coordenador_detalhe(request, entrada_id):
    entrada = get_object_or_404(EmailCoordenadorArea, id=entrada_id)

    if request.method == "DELETE":
        with transaction.atomic():
            remover_coordenador_por_email(entrada.email)
            entrada.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    email_antigo = entrada.email
    serializer = EmailCoordenadorAreaSerializer(entrada, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    novo_email = serializer.validated_data.get("email")
    novo_tipo_area = serializer.validated_data.get("tipo_area")
    email_vigente = novo_email if novo_email else email_antigo

    if novo_email and novo_email.lower() != email_antigo.lower():
        remover_coordenador_por_email(email_antigo)
    elif novo_tipo_area:
        # Sincroniza o tipo_area no CoordenadorArea do usuário correspondente.
        CoordenadorArea.objects.filter(usuario__email__iexact=email_vigente.strip()).update(
            tipo_area=novo_tipo_area
        )

    return Response(serializer.data)


def remover_coordenador_por_email(email: str) -> None:
    """Ao remover/alterar o e-mail de um coordenador, rebaixa o usuário local para COORDENADOR_PROJETO.
    O próximo login ressincroniza tudo com o HUB; aqui apenas antecipamos a mudança."""
    try:
        usuario = Usuario.objects.get(
            email__iexact=email.strip(), role=Usuario.Role.COORDENADOR_AREA
        )
    except Usuario.DoesNotExist:
        return
    with transaction.atomic():
        usuario.role = Usuario.Role.COORDENADOR_PROJETO
        usuario.save(update_fields=["role"])
        CoordenadorArea.objects.filter(usuario=usuario).delete()
        CoordenadorProjeto.objects.get_or_create(usuario=usuario)
