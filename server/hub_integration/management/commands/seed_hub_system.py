from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from hub_integration.models import System


class Command(BaseCommand):
    help = "Cria/atualiza o registro local do System com os dados cadastrados no HUB (via .env)."

    def handle(self, *args, **options):
        required = ["HUB_SYSTEM_ID", "HUB_SYSTEM_API_KEY", "HUB_SYSTEM_SECRET_KEY"]
        missing = [name for name in required if not getattr(settings, name, None)]

        if missing:
            raise CommandError(f"Defina no .env antes de rodar este comando: {', '.join(missing)}")

        system, created = System.objects.update_or_create(
            id=settings.HUB_SYSTEM_ID,
            defaults={
                "name": settings.HUB_SYSTEM_NAME,
                "system_url": settings.HUB_SYSTEM_URL,
                "is_active": True,
                "api_key": settings.HUB_SYSTEM_API_KEY,
                "current_state": System.CurrentState.EM_DESENVOLVIMENTO,
                "secret_key": settings.HUB_SYSTEM_SECRET_KEY,
            },
        )

        action = "criado" if created else "atualizado"
        self.stdout.write(self.style.SUCCESS(f"System '{system.name}' {action} (id={system.id})."))
