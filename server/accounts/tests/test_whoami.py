from unittest.mock import patch

from django.conf import settings
from django.test import TestCase

from accounts.models import Aluno, EmailCoordenadorArea

from .helpers import ALUNO_ID, SERVIDOR_ID, token_jwt


class WhoamiTests(TestCase):
    def _whoami(self, user_id, groups):
        self.client.cookies[settings.AUTH_COOKIE_NAME] = token_jwt(user_id, groups)
        return self.client.get("/api/hub/whoami/")

    def test_sem_cookie_nao_autentica(self):
        resposta = self.client.get("/api/hub/whoami/")
        self.assertEqual(resposta.status_code, 401)

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_primeiro_acesso_aluno_cria_usuario_e_perfil(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "aluno@ifrs.edu.br",
            "username": "Fulano",
            "access_profile": "aluno",
        }

        resposta = self._whoami(ALUNO_ID, groups=["user"])

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["role"], "ALUNO")
        self.assertTrue(Aluno.objects.filter(usuario_id=ALUNO_ID).exists())

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_servidor_sem_email_configurado_vira_coordenador_projeto(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "qualquer@ifrs.edu.br",
            "username": "Servidor",
            "access_profile": "servidor",
        }

        resposta = self._whoami(SERVIDOR_ID, groups=["user"])

        self.assertEqual(resposta.json()["role"], "COORDENADOR_PROJETO")

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_servidor_com_email_configurado_vira_coordenador_area(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "coord.ensino@ifrs.edu.br",
            "username": "Coord",
            "access_profile": "servidor",
        }

        EmailCoordenadorArea.objects.create(email="coord.ensino@ifrs.edu.br", tipo_area="ENSINO")
        resposta = self._whoami(SERVIDOR_ID, groups=["user"])

        self.assertEqual(resposta.json()["role"], "COORDENADOR_AREA")
        self.assertEqual(resposta.json()["tipo_area"], "ENSINO")

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_convidado_nao_tem_papel(self, mock_fetch):
        import uuid

        mock_fetch.return_value = {"email": None, "username": "", "access_profile": "convidado"}

        resposta = self._whoami(uuid.uuid4(), groups=[])

        self.assertEqual(resposta.status_code, 401)

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_hub_fora_do_ar_mantem_role_ja_conhecido(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "aluno@ifrs.edu.br",
            "username": "Fulano",
            "access_profile": "aluno",
        }
        self._whoami(ALUNO_ID, groups=["user"])

        mock_fetch.return_value = None
        resposta = self._whoami(ALUNO_ID, groups=["user"])

        self.assertEqual(resposta.status_code, 200)
        self.assertEqual(resposta.json()["role"], "ALUNO")
