import uuid
from unittest.mock import patch

import jwt
from django.conf import settings
from django.test import TestCase

from .models import Aluno

ALUNO_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
SERVIDOR_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")


def _token(user_id, groups):
    payload = {"user_id": str(user_id), "groups": groups, "permissions": []}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


class WhoamiTests(TestCase):
    def _whoami(self, user_id, groups):
        self.client.cookies[settings.AUTH_COOKIE_NAME] = _token(user_id, groups)
        return self.client.get("/api/hub/whoami/")

    def test_sem_cookie_nao_autentica(self):
        response = self.client.get("/api/hub/whoami/")
        self.assertEqual(response.status_code, 401)

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_primeiro_acesso_aluno_cria_usuario_e_perfil(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "aluno@ifrs.edu.br",
            "username": "Fulano",
            "access_profile": "aluno",
        }

        response = self._whoami(ALUNO_ID, groups=["user"])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "ALUNO")
        self.assertTrue(Aluno.objects.filter(usuario_id=ALUNO_ID).exists())

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_servidor_sem_email_configurado_vira_coordenador_projeto(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "qualquer@ifrs.edu.br",
            "username": "Servidor",
            "access_profile": "servidor",
        }

        response = self._whoami(SERVIDOR_ID, groups=["user"])

        self.assertEqual(response.json()["role"], "COORDENADOR_PROJETO")

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_servidor_com_email_configurado_vira_coordenador_area(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "coord.ensino@ifrs.edu.br",
            "username": "Coord",
            "access_profile": "servidor",
        }

        with self.settings(
            COORDENADOR_AREA_EMAILS={
                "ENSINO": "coord.ensino@ifrs.edu.br",
                "PESQUISA": "",
                "EXTENSAO": "",
            }
        ):
            response = self._whoami(SERVIDOR_ID, groups=["user"])

        self.assertEqual(response.json()["role"], "COORDENADOR_AREA")
        self.assertEqual(response.json()["tipo_area"], "ENSINO")

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_convidado_nao_tem_papel(self, mock_fetch):
        mock_fetch.return_value = {"email": None, "username": "", "access_profile": "convidado"}

        response = self._whoami(uuid.uuid4(), groups=[])

        self.assertEqual(response.status_code, 401)

    @patch("accounts.authentication.fetch_hub_user_data")
    def test_hub_fora_do_ar_mantem_role_ja_conhecido(self, mock_fetch):
        mock_fetch.return_value = {
            "email": "aluno@ifrs.edu.br",
            "username": "Fulano",
            "access_profile": "aluno",
        }
        self._whoami(ALUNO_ID, groups=["user"])

        mock_fetch.return_value = None
        response = self._whoami(ALUNO_ID, groups=["user"])

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "ALUNO")
