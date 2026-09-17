from accounts.models import CoordenadorArea, Usuario
from editais.models import Edital


def cria_coordenador_area(username, email, tipo_area=None):
    usuario = Usuario.objects.create_user(
        username=username, email=email, role=Usuario.Role.COORDENADOR_AREA
    )
    if tipo_area:
        CoordenadorArea.objects.create(usuario=usuario, tipo_area=tipo_area)
    else:
        CoordenadorArea.objects.create(usuario=usuario)
    return usuario


def cria_edital(nome="Edital Teste", ano_codigo="2026-001", status=Edital.Status.RASCUNHO):
    return Edital.objects.create(
        nome=nome,
        ano_codigo=ano_codigo,
        link_documento_oficial="https://example.com/edital.pdf",
        status=status,
    )
