from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Usuario
from editais.models import Edital


class EditalAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("editais:lista-criacao")
        self.coordenador = Usuario.objects.create_user(
            username="coordenador_teste",
            email="coordenador.teste@example.com",
            role=Usuario.Role.COORDENADOR_AREA,
        )
        self.dados = {
            "nome": "Edital de Bolsas 2026",
            "ano_codigo": "2026-001",
            "link_documento_oficial": "https://example.com/edital.pdf",
        }

    def test_coordenador_pode_cadastrar_edital(self):
        self.client.force_authenticate(user=self.coordenador)

        response = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Edital.objects.count(), 1)

        edital = Edital.objects.get()
        self.assertEqual(edital.nome, self.dados["nome"])
        self.assertEqual(edital.status, Edital.Status.RASCUNHO)
        self.assertEqual(response.data["id"], edital.id)

    def test_cadastro_nao_permite_escolher_status(self):
        self.client.force_authenticate(user=self.coordenador)
        dados = {**self.dados, "status": Edital.Status.EM_VIGOR}

        response = self.client.post(self.url, dados, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Edital.objects.get().status, Edital.Status.RASCUNHO)

    def test_coordenador_pode_listar_editais(self):
        self.client.force_authenticate(user=self.coordenador)
        primeiro = Edital.objects.create(**self.dados)
        segundo = Edital.objects.create(
            **{
                **self.dados,
                "nome": "Outro edital",
                "ano_codigo": "2026-002",
            }
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [edital["id"] for edital in response.data],
            [segundo.id, primeiro.id],
        )

    def test_cadastro_rejeita_dados_invalidos(self):
        self.client.force_authenticate(user=self.coordenador)
        casos = [
            ("ano_codigo", "2026/3"),
            ("link_documento_oficial", "nao-e-uma-url"),
            ("nome", ""),
        ]

        for campo, valor in casos:
            with self.subTest(campo=campo):
                dados = {**self.dados, campo: valor}

                response = self.client.post(self.url, dados, format="json")

                self.assertEqual(
                    response.status_code,
                    status.HTTP_400_BAD_REQUEST,
                )
                self.assertIn(campo, response.data)

        self.assertFalse(Edital.objects.exists())

    def test_outros_perfis_nao_podem_cadastrar(self):
        perfis = [
            Usuario.Role.ALUNO,
            Usuario.Role.COORDENADOR_PROJETO,
            Usuario.Role.ADMINISTRADOR,
        ]

        for perfil in perfis:
            with self.subTest(perfil=perfil):
                usuario = Usuario.objects.create_user(
                    username=f"teste_{perfil}",
                    email=f"teste_{perfil.lower()}@example.com",
                    role=perfil,
                )
                self.client.force_authenticate(user=usuario)

                resposta_post = self.client.post(
                    self.url,
                    self.dados,
                    format="json",
                )

                self.assertEqual(
                    resposta_post.status_code,
                    status.HTTP_403_FORBIDDEN,
                )

        self.assertFalse(Edital.objects.exists())

    def test_aluno_e_administrador_nao_podem_listar(self):
        for perfil in [Usuario.Role.ALUNO, Usuario.Role.ADMINISTRADOR]:
            with self.subTest(perfil=perfil):
                usuario = Usuario.objects.create_user(
                    username=f"teste_{perfil}",
                    email=f"teste_{perfil.lower()}@example.com",
                    role=perfil,
                )
                self.client.force_authenticate(user=usuario)

                resposta_get = self.client.get(self.url)

                self.assertEqual(resposta_get.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordenador_projeto_pode_listar_para_escolher_edital_ao_solicitar_bolsa(self):
        Edital.objects.create(**self.dados, status=Edital.Status.EM_VIGOR)
        coordenador_projeto = Usuario.objects.create_user(
            username="coord_projeto_teste",
            email="coord.projeto.teste@example.com",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        self.client.force_authenticate(user=coordenador_projeto)

        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)

    def test_visitante_nao_pode_listar_nem_cadastrar(self):
        resposta_get = self.client.get(self.url)
        resposta_post = self.client.post(
            self.url,
            self.dados,
            format="json",
        )

        self.assertEqual(
            resposta_get.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            resposta_post.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertFalse(Edital.objects.exists())

    def test_rejeita_codigo_repetido(self):
        self.client.force_authenticate(user=self.coordenador)
        Edital.objects.create(**self.dados)

        response = self.client.post(
            self.url,
            self.dados,
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ano_codigo", response.data)
        self.assertEqual(Edital.objects.count(), 1)
