from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa, StatusBolsa, TipoBolsa
from editais.models import Edital
from frequencias.tests import CenarioFrequencia

from .models import Projeto, StatusProjeto


def cria_usuario(username, email, role):
    return Usuario.objects.create(username=username, email=email, role=role)


def cria_coordenador_projeto(username, email):
    usuario = cria_usuario(username, email, Usuario.Role.COORDENADOR_PROJETO)
    CoordenadorProjeto.objects.create(usuario=usuario)
    return usuario


class ProjetoAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("projetos:lista-criacao")
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.dados = {"titulo": "Monitoramento de Qualidade de Software", "descricao": "..."}

    def test_coordenador_pode_criar_projeto(self):
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        projeto = Projeto.objects.get()
        self.assertEqual(projeto.titulo, self.dados["titulo"])
        self.assertEqual(projeto.status, StatusProjeto.ATIVO)
        self.assertEqual(projeto.coordenador_projeto.usuario_id, self.coordenador.id)

    def test_outro_perfil_nao_pode_criar_projeto(self):
        aluno = cria_usuario("aluno", "aluno@test.com", Usuario.Role.ALUNO)
        self.client.force_authenticate(user=aluno)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)

    def test_coordenador_so_lista_os_proprios_projetos(self):
        outro_coordenador = cria_coordenador_projeto("outro_cp", "outro@test.com")
        Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        Projeto.objects.create(
            titulo="Projeto B", coordenador_projeto=outro_coordenador.perfil_coordenador_projeto
        )

        self.client.force_authenticate(user=self.coordenador)
        resposta = self.client.get(self.url)

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        titulos = [item["titulo"] for item in resposta.data]
        self.assertEqual(titulos, ["Projeto A"])

    def test_nao_pode_desligar_projeto_de_outro_coordenador(self):
        outro_coordenador = cria_coordenador_projeto("outro_cp", "outro@test.com")
        projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=outro_coordenador.perfil_coordenador_projeto
        )

        self.client.force_authenticate(user=self.coordenador)
        resposta = self.client.post(reverse("projetos:desligar", args=[projeto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_403_FORBIDDEN)
        projeto.refresh_from_db()
        self.assertEqual(projeto.status, StatusProjeto.ATIVO)

    def test_desliga_projeto_sem_bolsa_bloqueante(self):
        projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(reverse("projetos:desligar", args=[projeto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_200_OK)
        projeto.refresh_from_db()
        self.assertEqual(projeto.status, StatusProjeto.DESLIGADO)

    def test_bloqueia_desligamento_com_bolsa_aberta(self):
        projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        edital = Edital.objects.create(
            nome="Edital Teste",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital.pdf",
            status=Edital.Status.EM_VIGOR,
        )
        Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
        )

        self.client.force_authenticate(user=self.coordenador)
        resposta = self.client.post(reverse("projetos:desligar", args=[projeto.id]))

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        projeto.refresh_from_db()
        self.assertEqual(projeto.status, StatusProjeto.ATIVO)


class ResumoDoProjetoTests(CenarioFrequencia):
    """Resumo das bolsas usado nos cards de Meus projetos (US93)."""

    def test_card_traz_tipos_bolsas_vagas_e_bolsistas(self):
        Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo="PESQUISA",
            modalidade="BIDTI",
            carga_horaria_semanal=16,
            valor_mensal=700,
            quantidade_vagas=2,
            status=StatusBolsa.SOLICITADA,
        )
        self.client.force_authenticate(self.coordenador)

        (projeto,) = self.client.get(reverse("projetos:lista-criacao")).data

        self.assertEqual(projeto["tipos_bolsa"], ["Ensino", "Pesquisa"])
        self.assertEqual(
            [(b["modalidade"], b["status"]) for b in projeto["bolsas_resumo"]],
            [("BICT", "PREENCHIDA"), ("BIDTI", "SOLICITADA")],
        )
        self.assertEqual(projeto["vagas_total"], 3)  # a solicitada ainda não conta
        self.assertEqual(projeto["bolsistas_ativos"], 1)


class EmentaProjetoTests(CenarioFrequencia):
    """Ementa escrita no editor da tela (US90): só a formatação do editor é guardada."""

    def salvar(self, html, usuario=None):
        self.client.force_authenticate(usuario or self.coordenador)
        url = reverse("projetos:ementa", kwargs={"pk": self.projeto.pk})
        return self.client.patch(url, {"ementa_html": html}, format="json")

    def test_guarda_a_formatacao_do_editor(self):
        html = "<h1>Título</h1><p>Texto com <b>negrito</b></p><ul><li>item</li></ul>"
        resposta = self.salvar(html)
        self.assertEqual(resposta.status_code, 200, resposta.data)
        self.projeto.refresh_from_db()
        self.assertEqual(self.projeto.ementa_html, html)
        self.assertEqual(resposta.data["ementa_html"], html)

    def test_remove_script_atributos_e_tags_fora_do_editor(self):
        self.salvar('<p onclick="x()" style="color:red">oi</p><script>alert(1)</script><img src=x>')
        self.projeto.refresh_from_db()
        self.assertEqual(self.projeto.ementa_html, "<p>oi</p>")

    def test_texto_apagado_no_editor_vira_vazio(self):
        self.salvar("<div><br></div>")
        self.projeto.refresh_from_db()
        self.assertEqual(self.projeto.ementa_html, "")

    def test_projeto_desligado_nao_altera(self):
        self.projeto.status = "DESLIGADO"
        self.projeto.save(update_fields=["status"])
        self.assertEqual(self.salvar("<p>oi</p>").status_code, 400)

    def test_outro_coordenador_nao_altera(self):
        outro = Usuario.objects.create_user(
            username="outro", email="outro@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        CoordenadorProjeto.objects.create(usuario=outro)
        self.assertEqual(self.salvar("<p>oi</p>", outro).status_code, 404)
