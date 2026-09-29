from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import TipoArea
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from editais.models import Edital
from projetos.models import Projeto

from .helpers import cria_coordenador_area, cria_coordenador_projeto, cria_edital


class SolicitarBolsaAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("bolsas:lista-criacao")
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.edital = cria_edital()
        self.dados = {
            "projeto": self.projeto.id,
            "edital": self.edital.id,
            "tipo": TipoBolsa.PESQUISA,
            "modalidade": "BICT",
            "carga_horaria_semanal": 12,
            "valor_mensal": "700.00",
        }

    def test_dono_do_projeto_pode_solicitar_bolsa(self):
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        bolsa = Bolsa.objects.get()
        self.assertEqual(bolsa.status, StatusBolsa.SOLICITADA)
        self.assertEqual(bolsa.projeto_id, self.projeto.id)

    def test_nao_dono_do_projeto_nao_pode_solicitar_bolsa(self):
        outro_coordenador = cria_coordenador_projeto("outro_cp", "outro@test.com")
        self.client.force_authenticate(user=outro_coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Bolsa.objects.exists())

    def test_nao_permite_edital_fora_de_vigor(self):
        edital_rascunho = cria_edital(ano_codigo="2026-002", status_edital=Edital.Status.RASCUNHO)
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(
            self.url, {**self.dados, "edital": edital_rascunho.id}, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("edital", resposta.data)
        self.assertFalse(Bolsa.objects.exists())

    def test_coordenador_area_nao_pode_solicitar_bolsa(self):
        coordenador_area = cria_coordenador_area("ca", "ca@test.com", TipoArea.PESQUISA)
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
