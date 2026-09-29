"""Helpers compartilhados para os testes de auditoria."""

from accounts.models import (
    Administrador,
    CoordenadorArea,
    CoordenadorProjeto,
    Usuario,
)
from bolsas.models import Bolsa, Modalidade, StatusBolsa, TipoBolsa
from editais.models import Edital
from projetos.models import Projeto


def criar_usuario(username, role, email=None):
    usuario = Usuario.objects.create_user(
        username=username,
        email=email or f"{username}@test.com",
        role=role,
        nome=username.replace("_", " ").title(),
    )
    return usuario


def criar_administrador(username="admin_teste"):
    usuario = criar_usuario(username, Usuario.Role.ADMINISTRADOR)
    Administrador.objects.create(usuario=usuario)
    return usuario


def criar_coordenador_area(username, tipo_area):
    usuario = criar_usuario(username, Usuario.Role.COORDENADOR_AREA)
    CoordenadorArea.objects.create(usuario=usuario, tipo_area=tipo_area)
    return usuario


def criar_coordenador_projeto(username="coord_proj_teste"):
    usuario = criar_usuario(username, Usuario.Role.COORDENADOR_PROJETO)
    CoordenadorProjeto.objects.create(usuario=usuario)
    return usuario


def criar_edital(ano_codigo="2026-TST", status=Edital.Status.EM_VIGOR):
    return Edital.objects.create(
        nome=f"Edital {ano_codigo}",
        ano_codigo=ano_codigo,
        link_documento_oficial="https://example.com/edital.pdf",
        status=status,
    )


def criar_bolsa(
    edital, coordenador_projeto, tipo=TipoBolsa.PESQUISA, bolsa_status=StatusBolsa.SOLICITADA
):
    projeto = Projeto.objects.create(
        titulo=f"Projeto {tipo}",
        coordenador_projeto=coordenador_projeto.perfil_coordenador_projeto,
    )
    return Bolsa.objects.create(
        projeto=projeto,
        edital=edital,
        tipo=tipo,
        modalidade=Modalidade.BICT,
        carga_horaria_semanal=12,
        valor_mensal=700,
        status=bolsa_status,
    )
