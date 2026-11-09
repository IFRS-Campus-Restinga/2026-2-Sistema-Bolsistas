from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from auditoria.models import AcaoAuditoria, EntidadeAuditoria
from auditoria.services import registrar_log
from bolsas.models import Bolsa, StatusBolsa
from editais.models import Edital
from frequencias.models import Frequencia, StatusPagamento
from frequencias.services import pendencias_da_area
from frequencias.tests import CenarioFrequencia, meses_atras
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


class ContadoresMenuTests(APITestCase):
    url = reverse("monitoramento:contadores-menu")

    def setUp(self):
        self.coordenador = Usuario.objects.create_user(
            username="coord", email="coord@example.com", role=Usuario.Role.COORDENADOR_PROJETO
        )
        projeto = Projeto.objects.create(
            titulo="Projeto",
            coordenador_projeto=CoordenadorProjeto.objects.create(usuario=self.coordenador),
        )
        self.area = Usuario.objects.create_user(
            username="area", email="area@example.com", role=Usuario.Role.COORDENADOR_AREA
        )
        CoordenadorArea.objects.create(usuario=self.area, tipo_area=TipoArea.PESQUISA)
        edital = Edital.objects.create(
            nome="Edital",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
            status=Edital.Status.EM_VIGOR,
        )

        def bolsa(tipo, status):
            return Bolsa.objects.create(
                projeto=projeto,
                edital=edital,
                tipo=tipo,
                modalidade="BICT",
                carga_horaria_semanal=12,
                valor_mensal=700,
                status=status,
            )

        self.bolsa = bolsa("PESQUISA", StatusBolsa.ABERTA)
        bolsa("PESQUISA", StatusBolsa.SOLICITADA)
        bolsa("INDISSOCIAVEL", StatusBolsa.SOLICITADA)
        bolsa("ENSINO", StatusBolsa.SOLICITADA)
        self.aluno = Usuario.objects.create_user(
            username="aluno", email="aluno@example.com", role=Usuario.Role.ALUNO
        )

    def contadores(self, usuario):
        self.client.force_authenticate(usuario)
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def test_aluno_ve_convites_aguardando_resposta(self):
        ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.PENDENTE,
        )

        self.assertEqual(self.contadores(self.aluno), {"convites": 1})

    def test_coordenador_de_projeto_ve_selecao_convites_e_finalizacao(self):
        pendente = Inscricao.objects.create(
            aluno=self.aluno, bolsa=self.bolsa, status=StatusInscricao.PENDENTE
        )
        indeferida = Inscricao.objects.create(
            aluno=Usuario.objects.create_user(
                username="bia", email="bia@example.com", role=Usuario.Role.ALUNO
            ),
            bolsa=self.bolsa,
            status=StatusInscricao.INDEFERIDA,
        )
        Recurso.objects.create(
            inscricao=indeferida, justificativa="Enviei.", status=StatusRecurso.PENDENTE
        )
        ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=self.aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.ENVIADO,
        )
        self.assertEqual(pendente.status, StatusInscricao.PENDENTE)

        self.assertEqual(
            self.contadores(self.coordenador),
            {"selecao": 2, "convites": 1, "finalizacao": 0},
        )

    def test_selecao_ignora_bolsas_preenchidas(self):
        Inscricao.objects.create(
            aluno=self.aluno, bolsa=self.bolsa, status=StatusInscricao.PENDENTE
        )
        self.bolsa.status = StatusBolsa.PREENCHIDA
        self.bolsa.save(update_fields=["status"])

        self.assertEqual(self.contadores(self.coordenador)["selecao"], 0)

    def test_coordenador_de_area_ve_solicitacoes_da_area(self):
        dados = self.contadores(self.area)

        # Pesquisa e Indissociável; a de Ensino é de outra área.
        self.assertEqual(dados["solicitacoes"], 2)
        self.assertEqual(dados["movimentacoes"], 0)
        self.assertEqual(dados["finalizacao"], 0)

    def test_area_ve_bolsa_finalizada_sem_ciencia(self):
        self.bolsa.status = StatusBolsa.ENCERRADA
        self.bolsa.finalizada_em = timezone.now()
        self.bolsa.save(update_fields=["status", "finalizada_em"])

        self.assertEqual(self.contadores(self.area)["finalizacao"], 1)

        self.bolsa.ciencia_finalizacao_em = timezone.now()
        self.bolsa.save(update_fields=["ciencia_finalizacao_em"])
        self.assertEqual(self.contadores(self.area)["finalizacao"], 0)

    def test_administrador_nao_tem_contadores(self):
        admin = Usuario.objects.create_user(
            username="admin", email="admin@example.com", role=Usuario.Role.ADMINISTRADOR
        )

        self.assertEqual(self.contadores(admin), {})

    def test_visitante_nao_acessa(self):
        self.assertIn(self.client.get(self.url).status_code, (401, 403))


class PainelAreaTests(CenarioFrequencia):
    """Início do coordenador de área (US92), no escopo da área (Ensino + Indissociável)."""

    url = reverse("monitoramento:painel-area")

    def painel(self):
        self.client.force_authenticate(self.area)
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def nova_bolsa(self, tipo, status):
        return Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=tipo,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=status,
        )

    def test_indicadores_ficam_no_escopo_da_area(self):
        self.nova_bolsa("ENSINO", StatusBolsa.SOLICITADA)
        self.nova_bolsa("INDISSOCIAVEL", StatusBolsa.ABERTA)
        self.nova_bolsa("PESQUISA", StatusBolsa.ABERTA)
        Frequencia.objects.create(
            vinculo=self.vinculo,
            mes_referencia=meses_atras(1),
            registrada=True,
            lancada_por=self.coordenador,
            status_pagamento=StatusPagamento.PENDENTE,
        )

        dados = self.painel()

        self.assertEqual(dados["editais_em_vigor"], 1)
        self.assertEqual(dados["bolsas_da_area"], 2)  # a preenchida e a indissociável
        self.assertEqual(dados["bolsas_aguardando_analise"], 1)
        self.assertEqual(dados["bolsistas_ativos"], 1)
        self.assertEqual(dados["pagamentos_a_autorizar"], 1)
        self.assertEqual(dados["atencao"]["solicitacoes"], 1)
        self.assertEqual(
            dados["atencao"]["frequencias_em_atraso"],
            sum(len(g["frequencias"]) for g in pendencias_da_area(self.area)),
        )
        self.assertEqual(
            {item["status"]: item["total"] for item in dados["bolsas_por_situacao"]},
            {"SOLICITADA": 1, "ABERTA": 1, "EM_SELECAO": 0, "PREENCHIDA": 1},
        )
        self.assertEqual(dados["total_bolsas"], 3)

    def test_vigencia_encerrada_sem_finalizacao_requer_atencao(self):
        self.bolsa.data_fim_vigencia = timezone.localdate() - timedelta(days=1)
        self.bolsa.save(update_fields=["data_fim_vigencia"])

        self.assertEqual(self.painel()["atencao"]["vigencias_encerradas"], 1)

    def test_proximos_prazos_ignoram_datas_passadas_e_vem_em_ordem(self):
        hoje = timezone.localdate()
        self.edital.data_fechamento_inscricoes = hoje - timedelta(days=1)
        self.edital.data_homologacao = hoje + timedelta(days=10)
        self.edital.data_resultado = hoje + timedelta(days=3)
        self.edital.save()

        prazos = self.painel()["proximos_prazos"]

        self.assertEqual([p["rotulo"] for p in prazos], ["Resultado final", "Homologação"])
        self.assertEqual([p["dias"] for p in prazos], [3, 10])
        self.assertEqual(prazos[0]["edital"], "2026-001")

    def test_so_o_coordenador_de_area_acessa(self):
        self.client.force_authenticate(self.coordenador)
        self.assertEqual(self.client.get(self.url).status_code, 403)


class PainelCoordenadorProjetoTests(CenarioFrequencia):
    """Início do coordenador de projeto (US92), só com o que é dos projetos dele."""

    url = reverse("monitoramento:painel-projeto")

    def painel(self):
        self.client.force_authenticate(self.coordenador)
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def bolsa_aberta(self):
        return Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo="ENSINO",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.ABERTA,
        )

    def test_indicadores_e_pendencias_de_selecao(self):
        aberta = self.bolsa_aberta()
        aluno = Usuario.objects.create_user(
            username="bia", email="bia@example.com", nome="Bia", role=Usuario.Role.ALUNO
        )
        Inscricao.objects.create(aluno=aluno, bolsa=aberta, status=StatusInscricao.PENDENTE)
        indeferida = Inscricao.objects.create(
            aluno=Usuario.objects.create_user(
                username="caio", email="caio@example.com", role=Usuario.Role.ALUNO
            ),
            bolsa=aberta,
            status=StatusInscricao.INDEFERIDA,
        )
        Recurso.objects.create(
            inscricao=indeferida, justificativa="Enviei.", status=StatusRecurso.PENDENTE
        )

        dados = self.painel()

        self.assertEqual(dados["projetos"], 1)
        self.assertEqual(dados["bolsas_abertas"], 1)
        self.assertEqual(dados["inscricoes_a_analisar"], 1)
        self.assertEqual(dados["bolsistas_ativos"], 1)
        self.assertEqual(dados["atencao"]["inscricoes"], 1)
        self.assertEqual(dados["atencao"]["recursos"], 1)

    def test_bolsistas_sem_frequencia_do_mes_anterior(self):
        lancado = self.criar_vinculo("bruno")
        Frequencia.objects.create(
            vinculo=lancado,
            mes_referencia=meses_atras(1),
            registrada=True,
            lancada_por=self.coordenador,
        )

        frequencias = self.painel()["frequencias_a_lancar"]

        self.assertEqual(frequencias["mes_referencia"], meses_atras(1))
        self.assertEqual([b["aluno_nome"] for b in frequencias["bolsistas"]], ["ana"])

    def test_agenda_traz_so_etapas_futuras(self):
        aberta = self.bolsa_aberta()
        agora = timezone.now()
        aberta.etapas.create(nome="Entrevista", peso=50, data_hora=agora + timedelta(days=2))
        aberta.etapas.create(nome="Prova", peso=50, data_hora=agora - timedelta(days=2))

        agenda = self.painel()["agenda"]

        self.assertEqual([etapa["nome"] for etapa in agenda], ["Entrevista"])

    def test_vigencia_encerrada_requer_atencao(self):
        self.bolsa.data_fim_vigencia = timezone.localdate() - timedelta(days=1)
        self.bolsa.save(update_fields=["data_fim_vigencia"])

        self.assertEqual(self.painel()["atencao"]["vigencias_encerradas"], 1)

    def test_so_o_coordenador_de_projeto_acessa(self):
        self.client.force_authenticate(self.area)
        self.assertEqual(self.client.get(self.url).status_code, 403)


class VisaoGeralAdminTests(CenarioFrequencia):
    """Números do início do administrador (protótipo), somados ao painel existente."""

    def visao_geral(self):
        admin = Usuario.objects.create_user(
            username="admin", email="admin@example.com", role=Usuario.Role.ADMINISTRADOR
        )
        self.client.force_authenticate(admin)
        resposta = self.client.get(reverse("monitoramento:painel"))
        self.assertEqual(resposta.status_code, 200)
        return resposta.data["visao_geral"]

    def test_indicadores_do_sistema_todo(self):
        Edital.objects.create(
            nome="Rascunho",
            ano_codigo="2026-099",
            link_documento_oficial="https://example.com/r",
            status=Edital.Status.RASCUNHO,
        )
        Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
            status=StatusBolsa.SOLICITADA,
        )
        Usuario.objects.create_user(
            username="inativo", email="inativo@example.com", is_active=False
        )

        dados = self.visao_geral()

        self.assertEqual(dados["editais_rascunho"], 1)
        self.assertEqual(dados["bolsas_ativas"], 1)
        self.assertEqual(dados["bolsas_aguardando_aprovacao"], 1)
        self.assertEqual(dados["bolsistas_ativos"], 1)
        self.assertEqual(dados["bolsistas_vinculo_direto"], 0)
        self.assertEqual(dados["usuarios_inativos"], 1)
        # coordenador, área, aluna do vínculo e o próprio admin
        self.assertEqual(dados["usuarios_ativos"], 4)
        self.assertEqual(dados["frequencias_sem_lancamento"], 1)
        self.assertEqual(dados["desligamentos_pendentes"], 0)


class PainelAlunoTests(CenarioFrequencia):
    """Início do aluno (US92): só o que é do aluno logado."""

    url = reverse("monitoramento:painel-aluno")

    def painel(self, aluno):
        self.client.force_authenticate(aluno)
        resposta = self.client.get(self.url)
        self.assertEqual(resposta.status_code, 200)
        return resposta.data

    def test_bolsista_ve_a_bolsa_ativa_com_a_vigencia(self):
        hoje = timezone.localdate()
        self.bolsa.data_inicio_vigencia = hoje - timedelta(days=10)
        self.bolsa.data_fim_vigencia = hoje + timedelta(days=30)
        self.bolsa.save(update_fields=["data_inicio_vigencia", "data_fim_vigencia"])
        Frequencia.objects.create(
            vinculo=self.vinculo,
            mes_referencia=meses_atras(1),
            registrada=True,
            lancada_por=self.coordenador,
        )

        dados = self.painel(self.vinculo.aluno)

        bolsa = dados["minha_bolsa"]
        self.assertEqual(bolsa["projeto_titulo"], "Projeto")
        self.assertEqual(bolsa["vigencia"]["dias_restantes"], 30)
        self.assertEqual(bolsa["vigencia"]["dias_decorridos"], 10)
        self.assertEqual(bolsa["vigencia"]["dias_total"], 40)
        self.assertEqual(dados["frequencias_cumpridas"], 1)
        self.assertFalse(dados["dados_bancarios_completos"])
        self.assertEqual(dados["inscricoes"], 1)  # a homologada do cenário

    def test_aluno_sem_bolsa_e_com_rascunho(self):
        aluno = Usuario.objects.create_user(
            username="novo", email="novo@example.com", role=Usuario.Role.ALUNO
        )
        Inscricao.objects.create(aluno=aluno, bolsa=self.bolsa, status=StatusInscricao.RASCUNHO)
        ConviteVinculoDireto.objects.create(
            bolsa=self.bolsa,
            aluno=aluno,
            coordenador_solicitante=self.coordenador,
            status=StatusConvite.PENDENTE,
        )

        dados = self.painel(aluno)

        self.assertIsNone(dados["minha_bolsa"])
        self.assertTrue(dados["inscricao_em_rascunho"])
        self.assertEqual(dados["convites_pendentes"], 1)
        self.assertEqual(dados["frequencias_cumpridas"], 0)

    def test_so_o_aluno_acessa(self):
        self.client.force_authenticate(self.coordenador)
        self.assertEqual(self.client.get(self.url).status_code, 403)
