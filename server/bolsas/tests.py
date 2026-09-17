from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from editais.models import Edital
from projetos.models import Projeto

from .models import Bolsa, StatusBolsa, TipoBolsa


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


class ListagemBolsaAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("bolsas:lista-criacao")
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.edital = cria_edital()

    def _cria_bolsa(self, tipo):
        return Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=tipo,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )

    def test_coordenador_area_ve_apenas_seu_tipo_e_indissociavel(self):
        bolsa_pesquisa = self._cria_bolsa(TipoBolsa.PESQUISA)
        self._cria_bolsa(TipoBolsa.ENSINO)
        bolsa_indissociavel = self._cria_bolsa(TipoBolsa.INDISSOCIAVEL)

        coordenador_area = cria_coordenador_area("ca", "ca@test.com", TipoArea.PESQUISA)
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.get(self.url)

        ids = {item["id"] for item in resposta.data}
        self.assertEqual(ids, {bolsa_pesquisa.id, bolsa_indissociavel.id})


class AprovarRejeitarBolsaAPITests(APITestCase):
    def setUp(self):
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.edital = cria_edital()
        self.bolsa = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )

    def test_coordenador_de_outra_area_nao_pode_aprovar(self):
        coordenador_area = cria_coordenador_area("ca_ensino", "ca_ensino@test.com", TipoArea.ENSINO)
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.SOLICITADA)

    def test_coordenador_da_mesma_area_aprova(self):
        coordenador_area = cria_coordenador_area(
            "ca_pesquisa", "ca_pesquisa@test.com", TipoArea.PESQUISA
        )
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.ABERTA)
        self.assertEqual(self.bolsa.coordenador_area.usuario_id, coordenador_area.id)
        self.assertIsNotNone(self.bolsa.data_decisao)

    def test_bolsa_indissociavel_pode_ser_aprovada_por_qualquer_coordenador_de_area(self):
        self.bolsa.tipo = TipoBolsa.INDISSOCIAVEL
        self.bolsa.save(update_fields=["tipo"])
        coordenador_area = cria_coordenador_area("ca_ensino", "ca_ensino@test.com", TipoArea.ENSINO)
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.ABERTA)

    def test_rejeitar_exige_justificativa(self):
        coordenador_area = cria_coordenador_area(
            "ca_pesquisa", "ca_pesquisa@test.com", TipoArea.PESQUISA
        )
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(
            reverse("bolsas:rejeitar", args=[self.bolsa.id]), {}, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.SOLICITADA)

    def test_rejeitar_com_justificativa(self):
        coordenador_area = cria_coordenador_area(
            "ca_pesquisa", "ca_pesquisa@test.com", TipoArea.PESQUISA
        )
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(
            reverse("bolsas:rejeitar", args=[self.bolsa.id]),
            {"justificativa": "Fora do escopo do edital."},
            format="json",
        )

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.REJEITADA)
        self.assertEqual(self.bolsa.justificativa_decisao, "Fora do escopo do edital.")

    def test_nao_aprova_bolsa_que_ja_foi_decidida(self):
        self.bolsa.status = StatusBolsa.ABERTA
        self.bolsa.save(update_fields=["status"])
        coordenador_area = cria_coordenador_area(
            "ca_pesquisa", "ca_pesquisa@test.com", TipoArea.PESQUISA
        )
        self.client.force_authenticate(user=coordenador_area)

        resposta = self.client.post(reverse("bolsas:aprovar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)


class CancelarBolsaAPITests(APITestCase):
    def setUp(self):
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.edital = cria_edital()
        self.bolsa = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )

    def test_dono_cancela_bolsa_solicitada(self):
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(reverse("bolsas:cancelar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        self.bolsa.refresh_from_db()
        self.assertEqual(self.bolsa.status, StatusBolsa.CANCELADA)

    def test_nao_dono_nao_cancela(self):
        outro_coordenador = cria_coordenador_projeto("outro_cp", "outro@test.com")
        self.client.force_authenticate(user=outro_coordenador)

        resposta = self.client.post(reverse("bolsas:cancelar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_nao_cancela_bolsa_ja_rejeitada(self):
        self.bolsa.status = StatusBolsa.REJEITADA
        self.bolsa.save(update_fields=["status"])
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(reverse("bolsas:cancelar", args=[self.bolsa.id]))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
