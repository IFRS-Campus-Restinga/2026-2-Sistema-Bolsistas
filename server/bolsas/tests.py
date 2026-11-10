from datetime import timedelta
from unittest import mock

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import CoordenadorArea, CoordenadorProjeto, TipoArea, Usuario
from editais.models import Edital
from inscricoes.models import Inscricao, StatusInscricao
from projetos.models import Projeto

from .models import Bolsa, EditalValorBolsa, StatusBolsa, TipoBolsa, TipoBolsaModalidade


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


def define_valor_no_edital(edital, modalidade="BICT", carga_horaria=12, valor="500.00"):
    tipo = TipoBolsaModalidade.objects.get(
        modalidade=modalidade, carga_horaria_semanal=carga_horaria
    )
    return EditalValorBolsa.objects.create(
        edital=edital, tipo_bolsa_modalidade=tipo, valor_mensal=valor
    )


class SolicitarBolsaAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("bolsas:lista-criacao")
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        self.edital = cria_edital()
        define_valor_no_edital(self.edital)
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

    def test_falha_no_aviso_desfaz_a_solicitacao(self):
        self.client.force_authenticate(user=self.coordenador)

        with (
            mock.patch("bolsas.views.Notificacao.enviar", side_effect=RuntimeError),
            self.assertRaises(RuntimeError),
        ):
            self.client.post(self.url, self.dados, format="json")

        self.assertFalse(Bolsa.objects.exists())

    def test_valor_mensal_vem_da_tabela_do_edital(self):
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resposta.data["valor_mensal"], "500.00")

    def test_combinacao_fora_do_edital_e_rejeitada(self):
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(
            self.url, {**self.dados, "carga_horaria_semanal": 16}, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("carga_horaria_semanal", resposta.data)
        self.assertFalse(Bolsa.objects.exists())

    def test_edital_sem_tabela_de_valores_nao_aceita_bolsa(self):
        outro_edital = cria_edital(ano_codigo="2026-009")
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(
            self.url, {**self.dados, "edital": outro_edital.id}, format="json"
        )

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("modalidade", resposta.data)

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

    def bolsa_vencida(self):
        return Bolsa.objects.create(
            projeto=Projeto.objects.create(
                titulo="Projeto antigo",
                coordenador_projeto=self.coordenador.perfil_coordenador_projeto,
            ),
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
            status=StatusBolsa.PREENCHIDA,
            data_fim_vigencia=timezone.localdate() - timedelta(days=1),
        )

    def test_pendencia_em_outro_projeto_bloqueia_a_solicitacao(self):
        self.bolsa_vencida()
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Resolva as pendências", resposta.data["detail"])
        [pendencia] = resposta.data["pendencias"]
        self.assertIn('"Projeto antigo"', pendencia)
        self.assertEqual(Bolsa.objects.count(), 1)

    def test_bolsa_vencida_ja_finalizada_nao_bloqueia(self):
        vencida = self.bolsa_vencida()
        vencida.status = StatusBolsa.ENCERRADA
        vencida.save(update_fields=["status"])
        self.client.force_authenticate(user=self.coordenador)

        resposta = self.client.post(self.url, self.dados, format="json")

        self.assertEqual(resposta.status_code, status.HTTP_201_CREATED, resposta.data)

    def test_lista_as_pendencias_do_coordenador(self):
        self.client.force_authenticate(user=self.coordenador)
        url = reverse("bolsas:pendencias")

        self.assertEqual(self.client.get(url).data, {"pendencias": []})

        self.bolsa_vencida()
        [pendencia] = self.client.get(url).data["pendencias"]
        self.assertIn('"Projeto antigo"', pendencia)

    def test_somente_coordenador_de_projeto_consulta_pendencias(self):
        coordenador_area = cria_coordenador_area("ca2", "ca2@test.com", TipoArea.PESQUISA)
        self.client.force_authenticate(user=coordenador_area)

        self.assertEqual(self.client.get(reverse("bolsas:pendencias")).status_code, 403)

    def test_lista_traz_codigo_do_edital_e_contagem_de_inscricoes(self):
        bolsa = Bolsa.objects.create(
            projeto=self.projeto,
            edital=self.edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
            status=StatusBolsa.ABERTA,
        )
        for indice, situacao in enumerate(
            [
                StatusInscricao.PENDENTE,
                StatusInscricao.PENDENTE,
                StatusInscricao.HOMOLOGADA,
                StatusInscricao.RASCUNHO,
                StatusInscricao.CANCELADA,
            ]
        ):
            Inscricao.objects.create(
                aluno=cria_usuario(f"aluno{indice}", f"a{indice}@test.com", Usuario.Role.ALUNO),
                bolsa=bolsa,
                status=situacao,
            )
        self.client.force_authenticate(user=self.coordenador)

        [item] = self.client.get(self.url).data

        self.assertEqual(item["edital_ano_codigo"], "2026-001")
        self.assertEqual(item["total_inscritos"], 3)
        self.assertEqual(item["inscricoes_pendentes"], 2)

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


class BolsasDisponiveisPermissaoTests(APITestCase):
    """As telas de bolsas disponíveis são do Aluno; os demais papéis não devem listar."""

    def setUp(self):
        self.coordenador_projeto = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        self.coordenador_area = cria_coordenador_area(
            "coord_area", "ca@test.com", TipoArea.PESQUISA
        )
        self.aluno = cria_usuario("aluno", "aluno@test.com", Usuario.Role.ALUNO)
        projeto = Projeto.objects.create(
            titulo="Projeto A",
            coordenador_projeto=self.coordenador_projeto.perfil_coordenador_projeto,
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=cria_edital(),
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="700.00",
            status=StatusBolsa.ABERTA,
        )

    def test_aluno_lista(self):
        self.client.force_authenticate(user=self.aluno)
        self.assertEqual(
            self.client.get(reverse("bolsas:disponiveis")).status_code, status.HTTP_200_OK
        )

    def test_outros_papeis_nao_listam(self):
        for usuario in [self.coordenador_projeto, self.coordenador_area]:
            with self.subTest(role=usuario.role):
                self.client.force_authenticate(user=usuario)
                self.assertEqual(
                    self.client.get(reverse("bolsas:disponiveis")).status_code,
                    status.HTTP_403_FORBIDDEN,
                )
                self.assertEqual(
                    self.client.get(
                        reverse("bolsas:disponivel-detalhe", args=[self.bolsa.id])
                    ).status_code,
                    status.HTTP_403_FORBIDDEN,
                )


class EdicaoSoNaBolsaSolicitadaTests(APITestCase):
    """Só a bolsa solicitada é editada; depois da aprovação, só as etapas (até o fim das
    inscrições)."""

    def setUp(self):
        self.coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        projeto = Projeto.objects.create(
            titulo="Projeto A", coordenador_projeto=self.coordenador.perfil_coordenador_projeto
        )
        edital = cria_edital()
        edital.data_fechamento_inscricoes = timezone.localdate() + timedelta(days=10)
        edital.save()
        define_valor_no_edital(edital)
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
            status=StatusBolsa.SOLICITADA,
        )
        self.client.force_authenticate(user=self.coordenador)

    def editar(self):
        url = reverse("bolsas:detalhe", args=[self.bolsa.id])
        return self.client.patch(url, {"quantidade_vagas": 2}, format="json")

    def nova_etapa(self):
        url = reverse("bolsas:etapas", kwargs={"bolsa_pk": self.bolsa.id})
        return self.client.post(url, {"nome": "Entrevista"}, format="json")

    def test_bolsa_solicitada_pode_ser_editada_mas_sem_etapas(self):
        self.assertEqual(self.editar().status_code, status.HTTP_200_OK)
        self.assertEqual(self.nova_etapa().status_code, status.HTTP_400_BAD_REQUEST)

    def test_bolsa_aberta_nao_pode_ser_editada_mas_recebe_etapas(self):
        self.bolsa.status = StatusBolsa.ABERTA
        self.bolsa.save(update_fields=["status"])

        resposta = self.editar()
        self.assertEqual(resposta.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("solicitada", str(resposta.data))
        self.assertEqual(self.nova_etapa().status_code, status.HTTP_201_CREATED)


class BolsasDisponiveisCardTests(APITestCase):
    """O que o card e o painel de Bolsas disponíveis do aluno usam (US93)."""

    def test_traz_coordenador_ementa_prazo_e_cronograma(self):
        coordenador = cria_coordenador_projeto("coord_projeto", "cp@test.com")
        coordenador.nome = "Joana Freitas"
        coordenador.save(update_fields=["nome"])
        projeto = Projeto.objects.create(
            titulo="Projeto A",
            coordenador_projeto=coordenador.perfil_coordenador_projeto,
            ementa_html="<p>Sobre</p>",
        )
        hoje = timezone.localdate()
        edital = cria_edital()
        edital.data_abertura_inscricoes = hoje - timedelta(days=2)
        edital.data_fechamento_inscricoes = hoje + timedelta(days=5)
        edital.data_homologacao = hoje + timedelta(days=8)
        edital.save()
        Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo=TipoBolsa.PESQUISA,
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal="500.00",
            status=StatusBolsa.ABERTA,
        )
        aluno = cria_usuario("aluno", "aluno@test.com", Usuario.Role.ALUNO)
        self.client.force_authenticate(user=aluno)

        (bolsa,) = self.client.get(reverse("bolsas:disponiveis")).data

        self.assertEqual(bolsa["coordenador_projeto_nome"], "Joana Freitas")
        self.assertEqual(bolsa["projeto_ementa_html"], "<p>Sobre</p>")
        self.assertEqual(bolsa["dias_para_encerrar_inscricoes"], 5)
        cronograma = bolsa["cronograma"]
        self.assertEqual(
            [f["rotulo"] for f in cronograma["fases"]][:2], ["Inscrições", "Homologação"]
        )
        self.assertEqual(cronograma["atual"], 0)  # ainda nas inscrições
