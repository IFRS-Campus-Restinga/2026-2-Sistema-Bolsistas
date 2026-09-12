"""Chamadas servidor-a-servidor para a API do HUB."""

import requests
from django.conf import settings


def fetch_hub_user_data(user_id: str, access_token: str) -> dict | None:
    try:
        response = requests.get(
            f"{settings.HUB_BASE_URL}/api/users/get/{user_id}/",
            params={"fields": "email,username,access_profile"},
            cookies={settings.AUTH_COOKIE_NAME: access_token},
            timeout=5,
        )
    except requests.RequestException:
        return None

    if response.status_code != 200:
        return None

    try:
        return response.json()
    except ValueError:
        return None
