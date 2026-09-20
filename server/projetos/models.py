from django.db import models

from accounts.models import CoordenadorProjeto


class StatusProjeto(models.TextChoices):
    ATIVO = "ATIVO", "Ativo"
    DESLIGADO = "DESLIGADO", "Desligado"


class Projeto(models.Model):
    titulo = models.CharField(max_length=200)
    descricao = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=15, choices=StatusProjeto.choices, default=StatusProjeto.ATIVO
    )
    coordenador_projeto = models.ForeignKey(
        CoordenadorProjeto,
        on_delete=models.PROTECT,
        related_name="projetos",
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-criado_em"]

    def __str__(self):
        return self.titulo
