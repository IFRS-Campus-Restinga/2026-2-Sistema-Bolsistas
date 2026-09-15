from django.core.validators import MinLengthValidator
from django.db import models


class Edital(models.Model):
    class Status(models.TextChoices):
        RASCUNHO = "RASCUNHO", "Rascunho"
        EM_VIGOR = "EM_VIGOR", "Em vigor"
        ENCERRADO = "ENCERRADO", "Encerrado"
        ARQUIVADO = "ARQUIVADO", "Arquivado"

    nome = models.CharField(
        max_length=200,
        validators=[MinLengthValidator(3)],
        help_text="Nome do edital (mínimo de 3 caracteres)",
    )
    ano_semestre = models.CharField(max_length=6, help_text="Ano e semestre (ex: 2022/1)")
    link_documento_oficial = models.URLField(
        max_length=500, help_text="Link para o documento oficial do edital"
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.RASCUNHO,
        help_text="Status do edital",
    )

    # Datas importantes do edital, podem ser nulas se ainda não foram definidas
    data_abertura_inscricoes = models.DateField(
        null=True,
        blank=True,
        help_text="Data de abertura das inscrições",
    )
    data_fechamento_inscricoes = models.DateField(
        null=True,
        blank=True,
        help_text="Data de fechamento das inscrições",
    )
    data_homologacao = models.DateField(
        null=True,
        blank=True,
        help_text="Data de homologação do edital",
    )
    data_recurso_homologacao_inicio = models.DateField(
        null=True,
        blank=True,
        help_text="Data de início dos recursos de homologação",
    )
    data_recurso_homologacao_fim = models.DateField(
        null=True,
        blank=True,
        help_text="Data de fim dos recursos de homologação",
    )
    data_resultado = models.DateField(
        null=True,
        blank=True,
        help_text="Data de divulgação do resultado final",
    )
    data_entrega_relatorios = models.DateField(
        null=True,
        blank=True,
        help_text="Data de entrega dos relatórios finais",
    )

    def __str__(self):
        return f"{self.nome} ({self.ano_semestre})"
