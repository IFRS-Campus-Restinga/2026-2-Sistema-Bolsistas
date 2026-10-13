from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, StatusInscricao
from projetos.models import Projeto


class MonitoramentoGlobalTests(APITestCase):
    def setUp(self):
        self.url = reverse("monitoramento:global")

        self.administrador = Usuario.objects.create_user(
            username="administrador",
            email="administrador@example.com",
            nome="Administrador",
            role=Usuario.Role.ADMINISTRADOR,
        )

        self.coordenador_usuario = Usuario.objects.create_user(
            username="coordenador",
            email="coordenador@example.com",
            nome="Coordenador",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        self.coordenador = CoordenadorProjeto.objects.create(
            usuario=self.coordenador_usuario,
        )
        Usuario.objects.create_user(
            username="usuario_inativo",
            email="inativo@example.com",
            nome="Usuário Inativo",
            role=Usuario.Role.ALUNO,
            is_active=False,
        )

        self.projeto = Projeto.objects.create(
            titulo="Projeto monitorado",
            coordenador_projeto=self.coordenador,
        )

        self.edital_ativo = Edital.objects.create(
            nome="Edital ativo",
            ano_codigo="2026-076",
            link_documento_oficial="https://example.com/ativo",
            status=Edital.Status.EM_VIGOR,
        )
        Edital.objects.create(
            nome="Edital rascunho",
            ano_codigo="2026-077",
            link_documento_oficial="https://example.com/rascunho",
            status=Edital.Status.RASCUNHO,
        )

        self.bolsa_aberta = self.criar_bolsa(StatusBolsa.ABERTA)
        self.criar_bolsa(StatusBolsa.EM_SELECAO)
        self.criar_bolsa(StatusBolsa.ENCERRADA)

        self.criar_inscricao("homologado", StatusInscricao.HOMOLOGADA)
        self.criar_inscricao("cancelado", StatusInscricao.CANCELADA)
        self.criar_inscricao("indeferido", StatusInscricao.INDEFERIDA)
        self.criar_inscricao("pendente", StatusInscricao.PENDENTE)

    def criar_bolsa(self, status):
        return Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital_ativo,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=status,
        )

    def criar_inscricao(self, identificador, status):
        aluno = Usuario.objects.create_user(
            username=f"aluno_{identificador}",
            email=f"{identificador}@example.com",
            nome=f"Aluno {identificador}",
            role=Usuario.Role.ALUNO,
        )
        return Inscricao.objects.create(
            aluno=aluno,
            bolsa=self.bolsa_aberta,
            status=status,
        )

    def test_visitante_nao_acessa_monitoramento(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 401)

    def test_aluno_nao_acessa_monitoramento(self):
        aluno = Usuario.objects.get(username="aluno_pendente")
        self.client.force_authenticate(aluno)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_coordenador_nao_acessa_monitoramento(self):
        self.client.force_authenticate(self.coordenador_usuario)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_administrador_recebe_totais_corretos(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["totais"],
            {
                "editais_ativos": 1,
                "projetos_cadastrados": 1,
                "usuarios_ativos": 6,
                "usuarios_inativos": 1,
                "bolsas_ativas": 2,
                "inscricoes_ativas": 1,
                "inscricoes_encerradas": 2,
            },
        )

    def test_administrador_recebe_detalhes_resumidos(self):
        self.client.force_authenticate(self.administrador)

        response = self.client.get(self.url)

        edital = response.data["detalhes"]["editais_ativos"][0]
        projeto = response.data["detalhes"]["projetos_cadastrados"][0]
        usuario_inativo = response.data["detalhes"]["usuarios_inativos"][0]
        inscricao = response.data["detalhes"]["inscricoes_ativas"][0]

        self.assertEqual(edital["nome"], "Edital ativo")
        self.assertEqual(projeto["titulo"], "Projeto monitorado")
        self.assertEqual(usuario_inativo["nome"], "Usuário Inativo")
        self.assertEqual(edital["ano_codigo"], "2026-076")
        self.assertEqual(inscricao["aluno"], "Aluno homologado")
        self.assertEqual(inscricao["projeto"], "Projeto monitorado")
        self.assertNotIn("cpf", inscricao)
        self.assertNotIn("conta", inscricao)
