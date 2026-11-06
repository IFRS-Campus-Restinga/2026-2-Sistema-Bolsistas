from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from inscricoes.models import Inscricao, Recurso, StatusInscricao, StatusRecurso
from projetos.models import Projeto
from selecao.models import (
    IndicacaoBolsista,
    PublicacaoResultado,
    ResultadoInscricao,
    SituacaoClassificacao,
)
from vinculo_direto.models import ConviteVinculoDireto, StatusConvite


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


class PainelAdministrativoTests(APITestCase):
    def setUp(self):
        self.url = reverse("monitoramento:painel")
        self.administrador = Usuario.objects.create_user(
            username="administrador",
            email="administrador@example.com",
            nome="Administrador",
            role=Usuario.Role.ADMINISTRADOR,
        )
        self.coordenador = Usuario.objects.create_user(
            username="coordenador",
            email="coordenador@example.com",
            nome="Coordenador",
            role=Usuario.Role.COORDENADOR_PROJETO,
        )
        self.projeto = Projeto.objects.create(
            titulo="Projeto",
            coordenador_projeto=CoordenadorProjeto.objects.create(usuario=self.coordenador),
        )
        self.edital = self.criar_edital("Edital 2026", "2026-001", Edital.Status.EM_VIGOR)
        self.outro_edital = self.criar_edital("Edital 2025", "2025-001", Edital.Status.ENCERRADO)
        self.criar_edital("Rascunho", "2026-999", Edital.Status.RASCUNHO)

        # Edital principal: 2 bolsas ofertadas (3 vagas de Ensino, 1 de Pesquisa) e 1 solicitada.
        self.ensino = self.criar_bolsa(self.edital, "ENSINO", StatusBolsa.EM_SELECAO, vagas=3)
        self.pesquisa = self.criar_bolsa(self.edital, "PESQUISA", StatusBolsa.ABERTA)
        self.criar_bolsa(self.edital, "EXTENSAO", StatusBolsa.SOLICITADA, vagas=5)
        antiga = self.criar_bolsa(self.outro_edital, "ENSINO", StatusBolsa.ENCERRADA, vagas=2)

        self.criar_inscricao("rascunho", self.ensino, StatusInscricao.RASCUNHO)
        self.criar_inscricao("pendente", self.ensino, StatusInscricao.PENDENTE)
        indeferido = self.criar_inscricao("indeferido", self.ensino, StatusInscricao.INDEFERIDA)
        titular = self.criar_inscricao("titular", self.ensino, StatusInscricao.HOMOLOGADA)
        suplente = self.criar_inscricao("suplente", self.ensino, StatusInscricao.HOMOLOGADA)
        self.criar_inscricao("antigo", antiga, StatusInscricao.PENDENTE)

        publicacao = PublicacaoResultado.objects.create(
            bolsa=self.ensino, responsavel=self.coordenador
        )
        ResultadoInscricao.objects.create(
            publicacao=publicacao,
            inscricao=titular,
            posicao=1,
            nota_final=9,
            situacao=SituacaoClassificacao.TITULAR,
        )
        ResultadoInscricao.objects.create(
            publicacao=publicacao,
            inscricao=suplente,
            posicao=2,
            nota_final=7,
            situacao=SituacaoClassificacao.SUPLENTE,
        )
        IndicacaoBolsista.objects.create(
            bolsa=self.ensino, inscricao=titular, responsavel=self.coordenador
        )

        Recurso.objects.create(
            inscricao=indeferido,
            justificativa="Documento enviado.",
            status=StatusRecurso.PENDENTE,
        )
        self.criar_convite("convidado", self.pesquisa, StatusConvite.APROVADO)
        self.criar_convite("aguardando", self.ensino, StatusConvite.ENVIADO)

    def criar_edital(self, nome, ano_codigo, status):
        return Edital.objects.create(
            nome=nome,
            ano_codigo=ano_codigo,
            link_documento_oficial="https://example.com/edital",
            status=status,
        )

    def criar_bolsa(self, edital, tipo, status, vagas=1):
        return Bolsa.objects.create(
            projeto=self.projeto,
            edital=edital,
            tipo=tipo,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            quantidade_vagas=vagas,
            status=status,
        )

    def criar_aluno(self, identificador):
        return Usuario.objects.create_user(
            username=f"aluno_{identificador}",
            email=f"{identificador}@example.com",
            nome=f"Aluno {identificador}",
            role=Usuario.Role.ALUNO,
        )

    def criar_inscricao(self, identificador, bolsa, status):
        return Inscricao.objects.create(
            aluno=self.criar_aluno(identificador), bolsa=bolsa, status=status
        )

    def criar_convite(self, identificador, bolsa, status):
        return ConviteVinculoDireto.objects.create(
            bolsa=bolsa,
            aluno=self.criar_aluno(identificador),
            coordenador_solicitante=self.coordenador,
            status=status,
        )

    def consultar(self, **parametros):
        self.client.force_authenticate(self.administrador)
        return self.client.get(self.url, parametros)

    def test_somente_administrador_acessa(self):
        self.client.force_authenticate(self.coordenador)

        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_lista_editais_sem_rascunho(self):
        response = self.consultar()

        self.assertEqual(
            [edital["ano_codigo"] for edital in response.data["editais"]],
            ["2026-001", "2025-001"],
        )
        self.assertEqual(response.data["editais_em_vigor"], 1)
        self.assertIsNone(response.data["edital"])

    def test_contagens_do_edital(self):
        response = self.consultar(edital=self.edital.pk)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["bolsas"], {"ofertadas": 2, "projetos": 1})
        self.assertEqual(response.data["vagas"]["ocupadas"], 2)
        self.assertEqual(response.data["vagas"]["total"], 4)
        self.assertEqual(
            {
                item["tipo"]: (item["ocupadas"], item["total"])
                for item in response.data["vagas"]["por_tipo"]
            },
            {"ENSINO": (1, 3), "PESQUISA": (1, 1), "EXTENSAO": (0, 0), "INDISSOCIAVEL": (0, 0)},
        )
        self.assertEqual(
            response.data["funil"],
            {"enviadas": 4, "homologadas": 2, "classificadas": 2, "vinculadas": 1},
        )
        self.assertEqual(
            response.data["pendencias"],
            {
                "bolsas_aguardando_aprovacao": 1,
                "recursos_sem_julgamento": 1,
                "convites_aguardando_analise": 1,
            },
        )

    def test_sem_filtro_soma_todos_os_editais(self):
        response = self.consultar()

        self.assertEqual(response.data["bolsas"]["ofertadas"], 3)
        self.assertEqual(response.data["vagas"]["total"], 6)
        self.assertEqual(response.data["funil"]["enviadas"], 5)

    def test_edital_invalido(self):
        rascunho = Edital.objects.get(status=Edital.Status.RASCUNHO)

        self.assertEqual(self.consultar(edital=rascunho.pk).status_code, 400)
        self.assertEqual(self.consultar(edital="abc").status_code, 400)

    def test_atividade_recente_traz_os_ultimos_logs(self):
        for numero in range(7):
            registrar_log(
                usuario=self.administrador,
                acao=AcaoAuditoria.ATUALIZACAO,
                entidade=EntidadeAuditoria.EDITAL,
                descricao=f"Alteração {numero}",
            )

        atividades = self.consultar().data["atividade_recente"]

        self.assertEqual(
            [atividade["descricao"] for atividade in atividades],
            [f"Alteração {numero}" for numero in range(6, 1, -1)],
        )
