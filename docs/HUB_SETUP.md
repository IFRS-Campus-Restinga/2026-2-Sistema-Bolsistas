# Setup local — integração com o HUB

Guia pra rodar o backend do Sistema de Bolsistas localmente já autenticando via HUB. Não cobre a lógica/arquitetura da integração (isso está no código, em `server/accounts` e `server/hub_integrations`), só os passos pra deixar o ambiente funcionando.

## 1. Suba o HUB localmente primeiro

O Sistema de Bolsistas depende do HUB rodando (é ele quem cuida do login). Siga o setup do repositório `sistemas` (branch `staging`), via Dev Containers do VS Code,  backend em `http://localhost:8000`, front em `http://localhost:3000`.

### Credencial do Google OAuth (necessária pra logar no HUB)

O login do HUB é só via Google, cada pessoa rodando o HUB localmente precisa da própria credencial (o Client ID de produção só libera o domínio real, não `localhost`):

1. Copie `sistemas/backend/.env.example` para `sistemas/backend/.env`, e `sistemas/frontend/.env.example` para `sistemas/frontend/.env`
2. Acesse [console.cloud.google.com](https://console.cloud.google.com) → **APIs e Serviços → Credenciais**.
3. **Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione:
   - `http://localhost:3000` (HUB rodando via Dev Containers)
   - `http://localhost:5173` (se algum dia rodar o front do HUB com `npm run dev` em vez de Dev Containers)
5. Em **URIs de redirecionamento autorizados**, adicione:
   - `http://localhost:8000/django-admin/google-callback/`
6. Copie o **Client ID** gerado (formato `algo.apps.googleusercontent.com`) — não precisa do Client Secret pro login normal.
7. Cole esse Client ID em **dois lugares** do HUB: `sistemas/backend/.env` (`GOOGLE_OAUTH2_CLIENT_ID`) e `sistemas/frontend/.env` (`VITE_GOOGLE_OAUTH2_CLIENT_ID`).

Confirme que subiu antes de continuar: acesse `http://localhost:3000` e logue com sua conta Google.

## 2. Instale as dependências do backend

```powershell
cd server
pip install -r requirements-dev.txt
```

## 3. Configure o `.env`

Copie `server/.env.example` pra `servers/.env` e preencha:

### `SECRET_KEY`

Essa é a chave que assina/valida o JWT, **precisa ser exatamente igual nos dois lados** (`.env` do HUB e `.env` do Sistema de Bolsistas). Não é uma chave que cada sistema gera a sua; é uma única chave, compartilhada, copiada nos dois arquivos.

Passo a passo:

1. O `.env.example` do HUB só traz um texto de exemplo tipo `your-secret-key-here-change-in-production`, não uma chave de verdade → você precisa gerar uma chave nova e colocar **nos dois `.env`** (HUB e Sistema de Bolsistas, o mesmo valor nos dois).

2. **Como gerar uma chave nova.** Duas opções, tanto faz qual:

   **Opção A: deixar o Django gerar uma aleatória de verdade** (recomendado, já sai no formato que o Django espera):
   ```powershell
   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
   ```
   Isso imprime uma string tipo `k9x!2mz8...`. Copie ela inteira.

   **Opção B: digitar algo aleatório na mão**, se não quiser rodar comando nenhum: qualquer string longa, misturando letras, números e símbolos, serve. Não existe validação de formato pois em dev local não tem tanto risco.

3. **Cole o mesmo valor gerado (Opção A ou B) em `SECRET_KEY` nos dois arquivos**: `sistemas/backend/.env` e `server/.env` (deste projeto).

### Resto das variáveis

- **`AUTH_COOKIE_NAME`, `REFRESH_COOKIE_NAME`**, mesmos valores do `.env` do HUB (os defaults do `.env.example` já batem com o padrão do HUB, normalmente não precisa mudar nada aqui).
- **`HUB_BASE_URL`**: `http://localhost:8000` em dev local.
- **`HUB_SYSTEM_API_KEY`**: só se consegue depois do passo 4 (mais abaixo).

## 4. Cadastre o Sistema de Bolsistas no seu HUB local

Cada pessoa que rodar o HUB localmente precisa cadastrar o sistema de novo (o `api_key` não é compartilhado entre ambientes).

1. Logado como admin no front do HUB (`localhost:3000`), abra o menu **Sistemas** → **+**.
2. Preencha: Nome = `Sistema de Bolsistas`, URL do sistema = `http://localhost:8001`, Secret Key = qualquer valor, Estado atual = `Em desenvolvimento`, Ativo.
3. **Equipe de desenvolvimento**: exige pelo menos 1 usuário com perfil `aluno`. Se não tiver nenhum, crie um rapidinho pelo shell do HUB:
   ```powershell
   docker exec -it hub-sistemas-ifrs-backend-1 python manage.py shell -c "
   from hub_users.services.user_service import UserService
   u, _ = UserService.create_user({'email': 'aluno.teste@example.com', 'first_name': 'Aluno', 'last_name': 'Teste', 'access_profile': 'aluno'})
   u.is_active = True; u.save()
   "
   ```
4. Depois de cadastrar, clique nos "..." do card do sistema criado e selecione "detalhes", ele mostra **ID do sistema** e **Chave de API do sistema**. Copie a Chave de API pra `HUB_SYSTEM_API_KEY` no `.env` do Sistema de Bolsistas.

## 5. Rode as migrations e suba o servidor

```powershell
python manage.py migrate
python manage.py runserver 8001
```

Acesse sempre como **`http://localhost:8001`**, nunca `127.0.0.1:8001` — os cookies do HUB são host-only e ficam presos ao host exato usado no login (`localhost`). Usar `127.0.0.1` faz o navegador não mandar o cookie, e a autenticação parece simplesmente não funcionar.

## 6. Teste o fluxo completo

1. Já logado no HUB (`localhost:3000`), vá em **Sistemas** e clique no card do **Sistema de Bolsistas**.
