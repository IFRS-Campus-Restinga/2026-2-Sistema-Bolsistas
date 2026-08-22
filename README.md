# 2026-2-Sistema-Bolsistas

Client em React (Vite) + servidor em Django.

## Setup do ambiente de desenvolvimento

### Backend (`server/`)

```bash
cd server
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements-dev.txt
```

### Frontend (`client/`)

```bash
cd client
npm install
```

### Hooks de git (lint automático)

O projeto usa [pre-commit](https://pre-commit.com) para rodar lint/formatação antes de cada commit e testes antes de cada push. Depois de instalar as dependências acima, rode uma vez na raiz do repositório:

```bash
pre-commit install --hook-type pre-commit --hook-type pre-push
```

O que roda em cada etapa:

- **pre-commit** (rápido, a cada commit): limpeza de arquivos (espaços em branco, EOF, conflitos de merge), Ruff (lint + format do backend), ESLint + Prettier (frontend) e o build do client (veja abaixo). Corrige automaticamente o que for possível — se algum arquivo for modificado, é só rodar `git add` de novo e commitar.
- **pre-push** (mais lento, a cada push): suíte de testes do Django (`manage.py test`) e lint completo do client.

### Como o front é servido (sem `npm run dev`)

Por orientação do professor, não rodamos o Vite em modo dev: o Django serve os arquivos estáticos direto da pasta `client/dist` (veja `server/server/settings.py` e `server/server/views/index_view.py`). Isso significa que sempre que algo em `client/` muda, a pasta `dist` precisa ser reconstruída — e isso é feito automaticamente pelo hook `build-client` do pre-commit, que roda `npm run build` e já inclui o resultado no commit. Ou seja: **ninguém precisa rodar `npm run build` manualmente**, só é preciso ter o `pre-commit install` feito (ver acima). `client/dist` é versionado de propósito, não é para editar esses arquivos à mão.

Pra rodar o projeto: `python server/manage.py runserver` e acessar a URL do Django — ele já serve as páginas do React.

Para rodar manualmente em todos os arquivos:

```bash
pre-commit run --all-files                    # hooks de commit
pre-commit run --all-files --hook-stage pre-push   # hooks de push
```

## Branch protection

`main` e `master` são protegidas por um ruleset no GitHub: mudanças só entram via Pull Request.
