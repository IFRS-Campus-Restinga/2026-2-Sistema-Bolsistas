"""
Middleware de autenticação antecipada para auditoria.

Por que este middleware existe:
- O HUB fornece identidade/papel via JWT em cookie.
- O DRF autentica esse JWT dentro da view (fase mais tardia do ciclo).
- O auditlog precisa de `request.user` já resolvido quando registra alterações.

Sem este middleware, mudanças podem ser salvas normalmente, porém alguns logs
podem ficar sem usuario correto porque a autenticação do DRF ainda não ocorreu no
momento em que o auditlog coleta contexto.

Responsabilidades:
- `hub_integration`: integração com o HUB e dados remotos.
- `accounts.authentication.HubJWTAuthentication`: valida JWT e sincroniza usuário.
- `HubJWTRequestUserMiddleware` (este arquivo): antecipa `request.user` para o
    restante do pipeline, inclusive auditoria.
"""

from rest_framework.exceptions import AuthenticationFailed

from .authentication import HubJWTAuthentication


class HubJWTRequestUserMiddleware:
    """
    Resolve `request.user` a partir do JWT em cookie antes do `AuditlogMiddleware`.

    Fluxo resumido:
    1) Se `request.user` já está autenticado, não faz nada.
    2) Se não está, tenta autenticar com `HubJWTAuthentication`.
    3) Se autenticar, salva em `request.user` e em `_hub_authenticated_user`
       (cache usado pela própria classe de autenticação).

    Em caso de token inválido/ausente, apenas segue o fluxo sem autenticar aqui;
    permissões finais continuam sendo aplicadas normalmente nas views.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.authentication = HubJWTAuthentication()

    def __call__(self, request):
        usuario_atual = getattr(request, "user", None)
        if not (usuario_atual and usuario_atual.is_authenticated):
            try:
                autenticacao = self.authentication.authenticate(request)
            except AuthenticationFailed:
                autenticacao = None

            if autenticacao:
                usuario, _ = autenticacao
                request.user = usuario
                request._hub_authenticated_user = usuario

        return self.get_response(request)
