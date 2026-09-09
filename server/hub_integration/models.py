from django.conf import settings
from django.db import models


class System(models.Model):
    """réplica local do registro do HUB para este sistema
    os nomes de campo presisam ser iguais ao do HUB para que o fs_auth_middleware funcione (is_valid_system_model)
    """

    class CurrentState(models.TextChoices):
        EM_DESENVOLVIMENTO = "Em desenvolvimento", "Em desenvolvimento"
        IMPLANTADO = "Implantado", "Implantado"

    id = models.UUIDField(primary_key=True, editable=False)
    name = models.CharField(max_length=50, unique=True)
    system_url = models.URLField(max_length=255)
    is_active = models.BooleanField(default=True)
    api_key = models.CharField(max_length=255)
    current_state = models.CharField(max_length=20, choices=CurrentState.choices)
    secret_key = models.CharField(max_length=200)
    dev_team = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True)

    def __str__(self):
        return self.name
