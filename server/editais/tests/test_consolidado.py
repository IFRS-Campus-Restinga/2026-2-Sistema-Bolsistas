"""Testes de US19: cronograma consolidado dos editais."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from bolsas.models import Bolsa, Modalidade, StatusBolsa, TipoBolsa
from editais.models import Edital
from projetos.models import Projeto


def _criar_coord_area(username, tipo_area):
    usuario = Usuario.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        role=Usuario.Role.COORDENADOR_AREA,
        nome=username,
    )
    CoordenadorArea.objects.create(usuario=usuario, tipo_area=tipo_area)
    return usuario


def _criar_coord_proj(username):
    usuario = Usuario.objects.create_user(
        username=username,
        email=f"{username}@test.com",
        role=Usuario.Role.COORDENADOR_PROJETO,
        nome=username,
    )
    CoordenadorProjeto.objects.create(usuario=usuario)
    return usuario


def _criar_edital(ano_codigo, edital_status=Edital.Status.EM_VIGOR):
    return Edital.objects.create(
        nome=f"Edital {ano_codigo}",
        ano_codigo=ano_codigo,
        link_documento_oficial="https://example.com",
        status=edital_status,
    )


def _criar_bolsa(edital, coord_proj, tipo):
    projeto = Projeto.objects.create(
        titulo=f"Proj {tipo}",
        coordenador_projeto=coord_proj.perfil_coordenador_projeto,
    )
    return Bolsa.objects.create(
        projeto=projeto,
        edital=edital,
        tipo=tipo,
        modalidade=Modalidade.BICT,
        carga_horaria_semanal=12,
        valor_mensal=700,
        status=StatusBolsa.SOLICITADA,
    )


class CronogramaConsolidadoTests(APITestCase):
    def setUp(self):
        self.coord_ensino = _criar_coord_area("coord_ens_us19", TipoArea.ENSINO)
        self.coord_pesquisa = _criar_coord_area("coord_pes_us19", TipoArea.PESQUISA)
        self.coord_proj = _criar_coord_proj("coord_proj_us19")

        self.edital_ensino = _criar_edital("2026-E19")
        self.edital_pesquisa = _criar_edital("2026-P19")
        self.edital_indissociavel = _criar_edital("2026-I19")

        _criar_bolsa(self.edital_ensino, self.coord_proj, TipoBolsa.ENSINO)
        _criar_bolsa(self.edital_pesquisa, self.coord_proj, TipoBolsa.PESQUISA)
        _criar_bolsa(self.edital_indissociavel, self.coord_proj, TipoBolsa.INDISSOCIAVEL)

    def test_coord_ensino_ve_ensino_e_indissociavel(self):
        self.client.force_authenticate(self.coord_ensino)
        response = self.client.get(reverse("editais:cronograma-consolidado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids_retornados = {item["id"] for item in response.data}
        self.assertIn(self.edital_ensino.pk, ids_retornados)
        self.assertIn(self.edital_indissociavel.pk, ids_retornados)
        self.assertNotIn(self.edital_pesquisa.pk, ids_retornados)

    def test_coord_pesquisa_ve_pesquisa_e_indissociavel(self):
        self.client.force_authenticate(self.coord_pesquisa)
        response = self.client.get(reverse("editais:cronograma-consolidado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids_retornados = {item["id"] for item in response.data}
        self.assertIn(self.edital_pesquisa.pk, ids_retornados)
        self.assertIn(self.edital_indissociavel.pk, ids_retornados)
        self.assertNotIn(self.edital_ensino.pk, ids_retornados)

    def test_rascunho_sem_bolsas_aparece_no_consolidado(self):
        """Edital sem bolsas também aparece para não ocultar edital recém-criado."""
        edital_rascunho = _criar_edital("2026-RSC", Edital.Status.RASCUNHO)

        self.client.force_authenticate(self.coord_ensino)
        response = self.client.get(reverse("editais:cronograma-consolidado"))

        ids_retornados = {item["id"] for item in response.data}
        self.assertIn(edital_rascunho.pk, ids_retornados)

    def test_payload_contem_datas_chave(self):
        self.client.force_authenticate(self.coord_ensino)
        response = self.client.get(reverse("editais:cronograma-consolidado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        if response.data:
            item = response.data[0]
            self.assertIn("data_abertura_inscricoes", item)
            self.assertIn("data_fechamento_inscricoes", item)
            self.assertIn("data_resultado", item)
            self.assertIn("status_display", item)
            self.assertIn("proxima_etapa", item)

    def test_nao_autenticado_recebe_401(self):
        response = self.client.get(reverse("editais:cronograma-consolidado"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_ve_editais_de_todas_as_areas(self):
        admin = Usuario.objects.create_user(
            username="admin_us19",
            email="admin.us19@test.com",
            role=Usuario.Role.ADMINISTRADOR,
            nome="Admin US19",
        )
        self.client.force_authenticate(admin)

        response = self.client.get(reverse("editais:cronograma-consolidado"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids_retornados = {item["id"] for item in response.data}
        self.assertIn(self.edital_ensino.pk, ids_retornados)
        self.assertIn(self.edital_pesquisa.pk, ids_retornados)
        self.assertIn(self.edital_indissociavel.pk, ids_retornados)
