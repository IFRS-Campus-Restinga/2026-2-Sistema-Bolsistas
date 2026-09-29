from django.apps import AppConfig


class AuditoriaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "auditoria"
    verbose_name = "Auditoria"

    def ready(self):
        from auditlog.registry import auditlog

        from accounts.models import CoordenadorArea, EmailCoordenadorArea, Usuario
        from bolsas.models import Bolsa, EtapaAvaliacao
        from editais.models import Edital
        from inscricoes.models import (
            AnexoRecurso,
            Documento,
            Inscricao,
            NotificacaoInscricao,
            Recurso,
        )
        from projetos.models import Projeto

        auditlog.register(Edital)
        auditlog.register(Bolsa)
        auditlog.register(EtapaAvaliacao)
        auditlog.register(Inscricao)
        auditlog.register(Documento)
        auditlog.register(Recurso)
        auditlog.register(AnexoRecurso)
        auditlog.register(NotificacaoInscricao)
        auditlog.register(Projeto)
        auditlog.register(Usuario)
        auditlog.register(CoordenadorArea)
        auditlog.register(EmailCoordenadorArea)
