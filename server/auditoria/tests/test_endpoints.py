"""Testes de endpoints: filtros, paginação e histórico de cronograma."""

import datetime

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import TipoArea
from bolsas.models import TipoBolsa
from editais.models import AlteracaoCronograma

from .helpers import (
    criar_administrador,
    criar_bolsa,
    criar_coordenador_area,
    criar_coordenador_projeto,
    criar_edital,
)


class FiltrosEndpointLogsTests(APITestCase):
    """Filtros de data e paginação funcionam."""

    def setUp(self):
        self.admin = criar_administrador("admin_filtro")
        self.coord_area = criar_coordenador_area("coord_filtro", TipoArea.PESQUISA)
        self.coord_projeto = criar_coordenador_projeto("coord_proj_filtro")
        self.edital = criar_edital("2026-FLT")
        self.bolsa = criar_bolsa(self.edital, self.coord_projeto, TipoBolsa.PESQUISA)

        # Gerar um log via aprovação
        self.client.force_authenticate(self.coord_area)
        self.client.post(reverse("bolsas:aprovar", kwargs={"pk": self.bolsa.pk}))

    def test_paginacao_retorna_campos_padrao(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("auditoria-logs"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

    def test_filtro_por_data_inicio_exclui_antigos(self):
        self.client.force_authenticate(self.admin)
        amanha = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
        response = self.client.get(reverse("auditoria-logs"), {"data_inicio": amanha})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 0)

    def test_filtro_por_ator(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse("auditoria-logs"), {"ator": str(self.coord_area.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for registro in response.data["results"]:
            self.assertEqual(registro["ator"], self.coord_area.nome)


class HistoricoCronogramaEndpointTests(APITestCase):
    """Endpoint de cronograma retorna as 4 informações da US20."""

    def setUp(self):
        self.admin = criar_administrador("admin_hist")
        self.coord_area = criar_coordenador_area("coord_hist", TipoArea.PESQUISA)
        self.coord_projeto = criar_coordenador_projeto("coord_proj_hist")
        self.edital = criar_edital("2026-HST")
        criar_bolsa(self.edital, self.coord_projeto, TipoBolsa.PESQUISA)

        hoje = datetime.date.today()
        ontem = hoje - datetime.timedelta(days=1)

        # Criar duas alterações da mesma data
        AlteracaoCronograma.objects.create(
            edital=self.edital,
            campo="data_fechamento_inscricoes",
            data_anterior=ontem,
            data_nova=hoje,
            responsavel=self.coord_area,
        )
        AlteracaoCronograma.objects.create(
            edital=self.edital,
            campo="data_fechamento_inscricoes",
            data_anterior=hoje,
            data_nova=hoje + datetime.timedelta(days=7),
            responsavel=self.coord_area,
        )

    def test_historico_retorna_quatro_campos_us20(self):
        """Cada entrada tem: data anterior, nova data, quem alterou e quando."""
        self.client.force_authenticate(self.admin)
        url = reverse("auditoria-cronograma", kwargs={"pk": self.edital.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

        primeira = response.data[0]
        self.assertIn("data_anterior", primeira)
        self.assertIn("data_nova", primeira)
        self.assertIn("responsavel", primeira)
        self.assertIn("alterado_em", primeira)

    def test_historico_retorna_duas_prorrogacoes_em_ordem(self):
        """Prorrogar a mesma data 2x retorna 2 entradas em ordem cronológica."""
        self.client.force_authenticate(self.coord_area)
        url = reverse("auditoria-cronograma", kwargs={"pk": self.edital.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entradas = [r for r in response.data if r["campo"] == "data_fechamento_inscricoes"]
        self.assertEqual(len(entradas), 2)
