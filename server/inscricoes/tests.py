from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CoordenadorProjeto, Usuario
from bolsas.models import Bolsa
from editais.models import Edital
from projetos.models import Projeto

from .models import Documento, Inscricao, StatusInscricao, TipoDocumento


class CandidatoListTests(APITestCase):
    def setUp(self):
        self.coordenador = self.usuario("coordenador", Usuario.Role.COORDENADOR_PROJETO)
        perfil = CoordenadorProjeto.objects.create(usuario=self.coordenador)
        projeto = Projeto.objects.create(titulo="Projeto teste", coordenador_projeto=perfil)
        edital = Edital.objects.create(
            nome="Edital teste",
            ano_codigo="2026-001",
            link_documento_oficial="https://example.com/edital",
        )
        self.bolsa = Bolsa.objects.create(
            projeto=projeto,
            edital=edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        self.url = reverse("inscricoes:candidatos", kwargs={"bolsa_pk": self.bolsa.pk})
        self.client.force_authenticate(self.coordenador)

    def usuario(self, nome, role=Usuario.Role.ALUNO):
        return Usuario.objects.create_user(
            username=nome,
            email=f"{nome}@example.com",
            role=role,
        )

    def inscricao(self, nome, **kwargs):
        dados = {
            "bolsa": self.bolsa,
            "status": StatusInscricao.PENDENTE,
            "data_envio": timezone.now(),
        }
        dados.update(kwargs)
        return Inscricao.objects.create(aluno=self.usuario(nome), **dados)

    def test_lista_apenas_enviadas_da_bolsa_solicitada(self):
        enviada = self.inscricao("enviada")
        enviada.aluno.nome = "Nome do aluno"
        enviada.aluno.save()
        self.inscricao("rascunho", status=StatusInscricao.RASCUNHO, data_envio=None)
        self.inscricao("cancelada", status=StatusInscricao.CANCELADA)
        self.inscricao("sem_envio", data_envio=None)
        outra_bolsa = Bolsa.objects.create(
            projeto=self.bolsa.projeto,
            edital=self.bolsa.edital,
            tipo="PESQUISA",
            modalidade="BICT",
            carga_horaria_semanal=12,
            valor_mensal=700,
        )
        self.inscricao("outra_bolsa", bolsa=outra_bolsa)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [enviada.pk])
        self.assertEqual(response.data[0]["aluno_nome"], "Nome do aluno")
        self.assertFalse(response.data[0]["documentacao_completa"])

    def test_documentacao_exige_os_dois_tipos_obrigatorios(self):
        inscricao = self.inscricao("documentos")
        for tipo in [TipoDocumento.HISTORICO_ESCOLAR, TipoDocumento.ADICIONAL]:
            Documento.objects.create(inscricao=inscricao, tipo=tipo, arquivo="teste.pdf")
        response = self.client.get(self.url)
        self.assertFalse(response.data[0]["documentacao_completa"])
        Documento.objects.create(
            inscricao=inscricao,
            tipo=TipoDocumento.COMPROVANTE_MATRICULA,
            arquivo="teste.pdf",
        )
        response = self.client.get(self.url)
        self.assertTrue(response.data[0]["documentacao_completa"])

    def test_outro_coordenador_nao_acessa_bolsa(self):
        outro = self.usuario("outro", Usuario.Role.COORDENADOR_PROJETO)
        CoordenadorProjeto.objects.create(usuario=outro)
        self.client.force_authenticate(outro)
        self.assertEqual(self.client.get(self.url).status_code, 404)

    def test_outros_perfis_nao_acessam(self):
        for role in [Usuario.Role.ALUNO, Usuario.Role.ADMINISTRADOR, Usuario.Role.COORDENADOR_AREA]:
            with self.subTest(role=role):
                self.client.force_authenticate(self.usuario(role, role))
                self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_visitante_nao_acessa(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_bolsa_inexistente_retorna_404(self):
        url = reverse("inscricoes:candidatos", kwargs={"bolsa_pk": self.bolsa.pk + 100})
        self.assertEqual(self.client.get(url).status_code, 404)

    def test_bolsa_sem_candidatos_retorna_lista_vazia(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])
