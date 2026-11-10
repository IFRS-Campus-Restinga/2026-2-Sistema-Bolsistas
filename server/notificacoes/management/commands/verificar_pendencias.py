from django.core.management.base import BaseCommand

from notificacoes.pendencias import verificar_pendencias


class Command(BaseCommand):
    help = (
        "Avisa os administradores sobre solicitações de bolsa paradas e recursos sem "
        "julgamento. Agende para rodar diariamente (cron ou Agendador de Tarefas)."
    )

    def handle(self, *args, **options):
        criadas = verificar_pendencias()
        self.stdout.write(self.style.SUCCESS(f"{criadas} notificação(ões) criada(s)."))
