from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from auditoria.services import registrar_log
from projetos.models import Projeto

from .models import CoordenadorArea, CoordenadorProjeto, EmailCoordenadorArea, Usuario
from .permissions import IsAdministrador
from .serializers import (
    CoordenadorAreaTipoSerializer,
    EmailCoordenadorAreaSerializer,
    UsuarioListSerializer,
)


@api_view(["GET"])
@permission_classes([IsAuthenticated, IsAdministrador])
def listar_usuarios(request):
    usuarios = Usuario.objects.select_related("perfil_coordenador_area").all().order_by("nome")
    return Response(UsuarioListSerializer(usuarios, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdministrador])
@transaction.atomic
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

    registrar_log(
        usuario=request.user,
        acao="AREA_COORDENADOR_ATUALIZADA",
        entidade="CoordenadorArea",
        entidade_id=perfil.pk,
        descricao=f"Área do coordenador {usuario.nome} atualizada.",
    )

    usuario.refresh_from_db()
    return Response(UsuarioListSerializer(usuario).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated, IsAdministrador])
@transaction.atomic
def atualizar_status(request, usuario_id):
    usuario = get_object_or_404(Usuario, id=usuario_id)
    is_active = request.data.get("is_active")
    if not isinstance(is_active, bool):
        return Response(
            {"is_active": ["Este campo é obrigatório e deve ser verdadeiro ou falso."]},
            status=status.HTTP_400_BAD_REQUEST,
        )
    usuario.is_active = is_active
    usuario.save(update_fields=["is_active"])

    registrar_log(
        usuario=request.user,
        acao="USUARIO_ATIVADO" if is_active else "USUARIO_DESATIVADO",
        entidade="Usuario",
        entidade_id=usuario.pk,
        descricao=f"Usuário {usuario.nome} {'ativado' if is_active else 'desativado'}.",
    )

    return Response(UsuarioListSerializer(usuario).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated, IsAdministrador])
def emails_coordenadores(request):
    if request.method == "GET":
        entradas = EmailCoordenadorArea.objects.all().order_by("email")
        return Response(EmailCoordenadorAreaSerializer(entradas, many=True).data)

    serializer = EmailCoordenadorAreaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        serializer.save()
        promover_coordenador_por_email(
            serializer.validated_data["email"], serializer.validated_data["tipo_area"]
        )
        registrar_log(
            usuario=request.user,
            acao="EMAIL_COORDENADOR_CADASTRADO",
            entidade="EmailCoordenadorArea",
            entidade_id=serializer.instance.pk,
            descricao="E-mail de coordenador de área cadastrado.",
        )
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated, IsAdministrador])
def email_coordenador_detalhe(request, entrada_id):
    entrada = get_object_or_404(EmailCoordenadorArea, id=entrada_id)

    if request.method == "DELETE":
        with transaction.atomic():
            entrada_id_log = entrada.pk
            remover_coordenador_por_email(entrada.email)
            entrada.delete()
            registrar_log(
                usuario=request.user,
                acao="EMAIL_COORDENADOR_REMOVIDO",
                entidade="EmailCoordenadorArea",
                entidade_id=entrada_id_log,
                descricao="E-mail de coordenador de área removido.",
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    email_antigo = entrada.email
    serializer = EmailCoordenadorAreaSerializer(entrada, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)

    with transaction.atomic():
        serializer.save()

        novo_email = serializer.validated_data.get("email")
        novo_tipo_area = serializer.validated_data.get("tipo_area")
        email_vigente = novo_email if novo_email else email_antigo

        if novo_email and novo_email.lower() != email_antigo.lower():
            remover_coordenador_por_email(email_antigo)
            promover_coordenador_por_email(novo_email, entrada.tipo_area)
        else:
            if novo_tipo_area:
                CoordenadorArea.objects.filter(usuario__email__iexact=email_vigente.strip()).update(
                    tipo_area=novo_tipo_area
                )
            promover_coordenador_por_email(email_vigente, entrada.tipo_area)

        registrar_log(
            usuario=request.user,
            acao="EMAIL_COORDENADOR_ATUALIZADO",
            entidade="EmailCoordenadorArea",
            entidade_id=entrada.pk,
            descricao="E-mail de coordenador de área atualizado.",
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


def promover_coordenador_por_email(email: str, tipo_area: str) -> None:
    """Ao adicionar/alterar e-mail de coordenador, promove o usuário caso já exista como COORDENADOR_PROJETO."""
    try:
        usuario = Usuario.objects.get(
            email__iexact=email.strip(), role=Usuario.Role.COORDENADOR_PROJETO
        )
    except Usuario.DoesNotExist:
        return

    if Projeto.objects.filter(coordenador_projeto__usuario=usuario).exists():
        raise ValidationError(
            {
                "detail": "Não é possível promover: o usuário ainda é coordenador de projeto(s) "
                "cadastrado(s) no sistema. Remova o(s) projeto(s) antes de promover."
            }
        )

    with transaction.atomic():
        usuario.role = Usuario.Role.COORDENADOR_AREA
        usuario.save(update_fields=["role"])
        CoordenadorProjeto.objects.filter(usuario=usuario).delete()
        CoordenadorArea.objects.update_or_create(usuario=usuario, defaults={"tipo_area": tipo_area})
