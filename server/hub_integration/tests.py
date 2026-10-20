from unittest.mock import patch

from django.conf import settings
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Usuario


@patch("accounts.authentication.fetch_hub_user_data", return_value=None)
class TrocaPerfilDevTests(APITestCase):
    def _entrar(self, papel):
        return self.client.post(reverse("dev-login", kwargs={"role": papel}))

    def _whoami(self):
        return self.client.get(reverse("hub-whoami"))

    @override_settings(DEBUG=True)
    def test_whoami_informa_modo_dev_ligado(self, _hub):
        self._entrar("aluno")
        self.assertIs(self._whoami().data["modo_dev"], True)

    @override_settings(DEBUG=True)
    def test_whoami_informa_modo_dev_desligado(self, _hub):
        self._entrar("aluno")
        with self.settings(DEBUG=False):
            self.assertIs(self._whoami().data["modo_dev"], False)

    @override_settings(DEBUG=False)
    def test_rotas_de_dev_nao_existem_fora_do_debug(self, _hub):
        self.assertEqual(self._entrar("aluno").status_code, 404)
        self.assertNotIn(settings.AUTH_COOKIE_NAME, self.client.cookies)

    @override_settings(DEBUG=True)
    def test_papel_invalido_e_recusado(self, _hub):
        self.assertEqual(self._entrar("diretor").status_code, 400)

    @override_settings(DEBUG=True)
    def test_troca_de_perfil_substitui_a_sessao(self, _hub):
        papeis = {
            "aluno": Usuario.Role.ALUNO,
            "coordenador-projeto": Usuario.Role.COORDENADOR_PROJETO,
            "coordenador-area": Usuario.Role.COORDENADOR_AREA,
            "admin": Usuario.Role.ADMINISTRADOR,
        }
        for papel, role in papeis.items():
            with self.subTest(papel=papel):
                self.assertEqual(self._entrar(papel).status_code, 200)
                resposta = self._whoami()
                self.assertEqual(resposta.status_code, 200)
                self.assertEqual(resposta.data["role"], role)
