from django.test import SimpleTestCase


class RoteamentoApiVsSpaTests(SimpleTestCase):
    """O catch-all entrega o SPA, mas não pode engolir rota de API inexistente."""

    def test_rota_de_api_inexistente_devolve_404(self):
        resposta = self.client.get("/api/rota-que-nao-existe/")

        self.assertEqual(resposta.status_code, 404)
        # Antes caía no catch-all e devolvia o HTML do SPA com status 200,
        # quebrando o res.json() do cliente em vez de sinalizar o erro.
        self.assertNotIn(b'id="root"', resposta.content)

    def test_rota_de_front_cai_no_spa(self):
        resposta = self.client.get("/aluno")

        self.assertEqual(resposta.status_code, 200)
        self.assertIn(b'id="root"', resposta.content)
