from accounts.models import CoordenadorArea, CoordenadorProjeto, Usuario
from editais.models import Edital


def cria_usuario(username, email, role):
    return Usuario.objects.create(username=username, email=email, role=role)


def cria_coordenador_projeto(username, email):
    usuario = cria_usuario(username, email, Usuario.Role.COORDENADOR_PROJETO)
    CoordenadorProjeto.objects.create(usuario=usuario)
    return usuario


def cria_coordenador_area(username, email, tipo_area):
    usuario = cria_usuario(username, email, Usuario.Role.COORDENADOR_AREA)
    CoordenadorArea.objects.create(usuario=usuario, tipo_area=tipo_area)
    return usuario


def cria_edital(ano_codigo="2026-001", status_edital=Edital.Status.EM_VIGOR):
    return Edital.objects.create(
        nome="Edital Teste",
        ano_codigo=ano_codigo,
        link_documento_oficial="https://example.com/edital.pdf",
        status=status_edital,
    )
