"""Testes de escopo: quem vê o quê no log de auditoria."""

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import TipoArea, Usuario
from bolsas.models import TipoBolsa

from .helpers import (
    criar_administrador,
    criar_bolsa,
    criar_coordenador_area,
    criar_coordenador_projeto,
    criar_edital,
    criar_usuario,
)


class EscopoAuditoriaTests(APITestCase):
    """Admin vê tudo; coordenador de ENSINO não vê logs de PESQUISA; vê INDISSOCIAVEL; outros recebem 403."""

    def setUp(self):
        self.admin = criar_administrador("admin_escopo")
        self.coord_ensino = criar_coordenador_area("coord_ensino_escopo", TipoArea.ENSINO)
        self.coord_pesquisa = criar_coordenador_area("coord_pesquisa_escopo", TipoArea.PESQUISA)
        self.coord_projeto = criar_coordenador_projeto("coord_proj_escopo")
        self.aluno = criar_usuario("aluno_escopo", Usuario.Role.ALUNO)

        self.edital = criar_edital("2026-ESC")
        self.bolsa_ensino = criar_bolsa(self.edital, self.coord_projeto, TipoBolsa.ENSINO)
        self.bolsa_pesquisa = criar_bolsa(self.edital, self.coord_projeto, TipoBolsa.PESQUISA)
        self.bolsa_indissociavel = criar_bolsa(
            self.edital, self.coord_projeto, TipoBolsa.INDISSOCIAVEL
        )

        # Gerar logs para as bolsas: coord_pesquisa aprova bolsa_pesquisa
        self.client.force_authenticate(self.coord_pesquisa)
        self.client.post(reverse("bolsas:aprovar", kwargs={"pk": self.bolsa_pesquisa.pk}))
        # coord_ensino aprova bolsa_ensino
        self.client.force_authenticate(self.coord_ensino)
        self.client.post(reverse("bolsas:aprovar", kwargs={"pk": self.bolsa_ensino.pk}))
        # coord_pesquisa aprova bolsa_indissociavel
        self.client.force_authenticate(self.coord_pesquisa)
        self.client.post(reverse("bolsas:aprovar", kwargs={"pk": self.bolsa_indissociavel.pk}))

    def test_admin_ve_todos_os_logs(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Admin deve ver todos os logs gerados
        self.assertGreater(response.data["count"], 0)

    def test_aluno_recebe_403(self):
        self.client.force_authenticate(self.aluno)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_projeto_recebe_403(self):
        self.client.force_authenticate(self.coord_projeto)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_coord_ensino_nao_ve_logs_de_bolsa_pesquisa(self):
        self.client.force_authenticate(self.coord_ensino)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pks_nos_logs = {r["recurso"] for r in response.data["results"]}
        recurso_bolsa_pesquisa = f"Bolsa: {self.bolsa_pesquisa}"
        self.assertNotIn(recurso_bolsa_pesquisa, pks_nos_logs)

    def test_coord_ensino_ve_logs_de_bolsa_indissociavel(self):
        self.client.force_authenticate(self.coord_ensino)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        pks_nos_logs = {r["recurso"] for r in response.data["results"]}
        recurso_bolsa_indissociavel = f"Bolsa: {self.bolsa_indissociavel}"
        self.assertIn(recurso_bolsa_indissociavel, pks_nos_logs)


class HistoricoCronogramaEscopoTests(APITestCase):
    """Endpoint de cronograma respeita escopo do coordenador."""

    def setUp(self):
        self.admin = criar_administrador("admin_cron")
        self.coord_pesquisa = criar_coordenador_area("coord_pesq_cron", TipoArea.PESQUISA)
        self.coord_ensino = criar_coordenador_area("coord_ens_cron", TipoArea.ENSINO)
        self.coord_projeto = criar_coordenador_projeto("coord_proj_cron")

        self.edital = criar_edital("2026-CRN")
        self.bolsa_pesquisa = criar_bolsa(self.edital, self.coord_projeto, TipoBolsa.PESQUISA)

    def test_admin_ve_historico_de_qualquer_edital(self):
        self.client.force_authenticate(self.admin)
        url = reverse("auditoria-cronograma", kwargs={"pk": self.edital.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coord_pesquisa_ve_historico_do_seu_edital(self):
        self.client.force_authenticate(self.coord_pesquisa)
        url = reverse("auditoria-cronograma", kwargs={"pk": self.edital.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_coord_ensino_nao_ve_historico_de_edital_so_pesquisa(self):
        self.client.force_authenticate(self.coord_ensino)
        url = reverse("auditoria-cronograma", kwargs={"pk": self.edital.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
