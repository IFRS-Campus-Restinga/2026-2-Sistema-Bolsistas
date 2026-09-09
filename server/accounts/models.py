import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models


class Usuario(AbstractUser):
    class Role(models.TextChoices):
        ALUNO = "ALUNO", "Aluno"
        COORDENADOR_PROJETO = "COORDENADOR_PROJETO", "Coordenador de Projeto"
        COORDENADOR_AREA = "COORDENADOR_AREA", "Coordenador de Área"
        ADMINISTRADOR = "ADMINISTRADOR", "Administrador"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, null=True, blank=True)
    nome = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=25, choices=Role.choices)

    def __str__(self):
        return self.nome or self.username


class TipoArea(models.TextChoices):
    ENSINO = "ENSINO", "Ensino"
    PESQUISA = "PESQUISA", "Pesquisa"
    EXTENSAO = "EXTENSAO", "Extensão"


class Aluno(models.Model):
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name="perfil_aluno")

    def __str__(self):
        return self.usuario.nome


class CoordenadorProjeto(models.Model):
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_coordenador_projeto"
    )

    def __str__(self):
        return self.usuario.nome


class CoordenadorArea(models.Model):
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_coordenador_area"
    )

    tipo_area = models.CharField(max_length=20, choices=TipoArea.choices)

    def __str__(self):
        return f"{self.usuario.nome} ({self.get_tipo_area_display()})"


class Administrador(models.Model):
    usuario = models.OneToOneField(
        Usuario, on_delete=models.CASCADE, related_name="perfil_administrador"
    )

    def __str__(self):
        return self.usuario.nome
