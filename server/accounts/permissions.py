from rest_framework.permissions import BasePermission

from .models import Usuario


def _has_role(user, role):
    return bool(user and user.is_authenticated and user.role == role)


class IsAluno(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request.user, Usuario.Role.ALUNO)


class IsCoordenadorProjeto(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request.user, Usuario.Role.COORDENADOR_PROJETO)


class IsCoordenadorArea(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request.user, Usuario.Role.COORDENADOR_AREA)


class IsAdministrador(BasePermission):
    def has_permission(self, request, view):
        return _has_role(request.user, Usuario.Role.ADMINISTRADOR)
