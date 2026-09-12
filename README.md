# Sistema de Bolsistas

Sistema web para gestão de bolsistas, com frontend em React e backend em Django, servidos juntos como uma única aplicação.

## Como rodar o projeto

### 1. Backend (`server/`)

```bash
cd server
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements-dev.txt
python manage.py runserver
```

Isso já sobe o servidor Django, que também serve as páginas do React.

### 2. Frontend (`client/`)

```bash
cd client
npm install
```

Para desenvolvimento local do frontend, use o modo dev do Vite normalmente:

```bash
npm run dev
```

Isso te dá hot-reload rápido enquanto mexe no React. **Não é necessário** rodar `npm run build` manualmente no dia a dia: o Django, em produção/para quem só quer rodar o projeto pronto, serve os arquivos já buildados da pasta `client/dist`. Essa pasta é versionada e atualizada automaticamente antes de cada push (veja a seção abaixo), então ela fica sempre sincronizada com o código mais recente do `client/`.

### 3. Regras de commit e push

Antes de instalar as dependências acima, é preciso rodar uma vez na raiz do repositório:

```bash
pre-commit install --hook-type pre-commit --hook-type pre-push
```

O projeto usa checagens automáticas de lint, formatação e testes a cada commit/push. A ideia é garantir que o código que chega no repositório siga um padrão mínimo de qualidade e que a pasta `client/dist` nunca fique desatualizada em relação ao código do frontend — evitando que alguém suba uma mudança no React e esqueça de atualizar a versão buildada que o Django realmente serve. Essas checagens rodam automaticamente nos comandos normais de `git commit` e `git push`, então não é preciso executá-las manualmente.

## Branch protection

`main` e `master` são protegidas por um ruleset no GitHub: mudanças só entram via Pull Request.
