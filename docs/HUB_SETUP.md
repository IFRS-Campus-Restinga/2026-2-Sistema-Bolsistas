# Integração com o HUB

O Sistema de Bolsistas não tem login próprio — a autenticação é delegada ao HUB de Sistemas. Esta página explica como a integração funciona e como configurar o ambiente.

## Como funciona

1. O usuário acessa o Sistema de Bolsistas a partir do HUB, que injeta um cookie JWT assinado (`access_token`).
2. A cada requisição, `HubJWTAuthentication` (em `accounts/authentication.py`) decodifica o JWT usando a mesma `SECRET_KEY` configurada no HUB.
3. O token contém `user_id` e `groups`. Com isso, o sistema:
   - Busca dados complementares do usuário na API do HUB (`/api/users/get/<id>/`) — e-mail, nome, `access_profile`.
   - Resolve a `role` local (`ADMINISTRADOR`, `ALUNO`, `COORDENADOR_PROJETO`, `COORDENADOR_AREA`).
   - Cria ou atualiza o registro `Usuario` e o perfil correspondente no banco local.
4. A `role` é determinada assim:

   | Condição no HUB                            | Role local          |
   |--------------------------------------------|---------------------|
   | grupo `admin`                              | `ADMINISTRADOR`     |
   | `access_profile = aluno`                   | `ALUNO`             |
   | `access_profile = servidor` + e-mail na lista `EmailCoordenadorArea` | `COORDENADOR_AREA` |
   | `access_profile = servidor` (sem e-mail na lista) | `COORDENADOR_PROJETO` |

## Variáveis de ambiente

Copie `server/.env.example` para `server/.env` e preencha:

| Variável | Descrição |
|---|---|
| `SECRET_KEY` | **Deve ser igual** à `SECRET_KEY` do HUB — é usada para assinar/verificar o JWT |
| `HUB_BASE_URL` | URL base do HUB (ex: `http://localhost:8000`) |
| `HUB_SYSTEM_ID` | ID deste sistema registrado no HUB |
| `HUB_SYSTEM_API_KEY` | Chave de API para chamadas servidor-a-servidor |
| `HUB_SYSTEM_SECRET_KEY` | Chave secreta do sistema no HUB |
| `AUTH_COOKIE_NAME` | Nome do cookie JWT (padrão: `access_token`) |

## Login de teste (só em desenvolvimento)

Com `DEBUG=True`, estão disponíveis endpoints para simular login sem o HUB:

```
POST /api/hub/dev/login/admin/
POST /api/hub/dev/login/aluno/
POST /api/hub/dev/login/coordenador-projeto/
POST /api/hub/dev/login/coordenador-area/

POST /api/hub/dev/logout/
```

Cada chamada cria um usuário fictício no banco e seta o cookie `access_token`. O coordenador de área de teste recebe `tipo_area = EXTENSAO` por padrão (definido em `hub_integration/dev_auth.py`).

> Esses endpoints retornam 404 em produção (`DEBUG=False`).

## Coordenadores de Área

A lista de e-mails que concede a role `COORDENADOR_AREA` é gerenciada pelo administrador no painel em **Usuários → E-mails de Coordenadores de Área**. Qualquer servidor cujo e-mail conste nessa lista receberá a role e o `tipo_area` correspondente automaticamente no login.

Se o e-mail for removido da lista, o usuário é rebaixado para `COORDENADOR_PROJETO` imediatamente (sem precisar fazer logout/login).
