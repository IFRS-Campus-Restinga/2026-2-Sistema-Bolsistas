from django.urls import path

from .dev_auth import dev_login, dev_logout
from .views import whoami

urlpatterns = [
    path("whoami/", whoami, name="hub-whoami"),
    # login de teste — só existe com DEBUG=True, ver hub_integration/dev_auth.py.
    path("dev/login/<str:role>/", dev_login, name="dev-login"),
    path("dev/logout/", dev_logout, name="dev-logout"),
]
