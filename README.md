# Sentinela CIS

Plataforma web de **avaliação de maturidade CIS Controls v8.1.2** e **gestão de riscos** de segurança da informação.

> Evolução do protótipo em [`docs/prototipo-demo.html`](docs/prototipo-demo.html) para uma aplicação multiusuário, com backend, banco de dados e SSO corporativo (SAML), pronta para rodar em **Ubuntu Server**.

## Funcionalidades

- **Dashboard** — KPIs, velocímetro de maturidade, espectro de cobertura dos 18 controles, matriz de risco (inerente/residual), distribuição de maturidade, insights automáticos e cruzamento risco × maturidade dos controles.
- **Auditoria** — avaliação por salvaguarda (acordeão), escala de maturidade 0–5, evidências em texto e **upload real de arquivo**, texto oficial da norma (EN).
- **Riscos** — registro completo: probabilidade/impacto inerente e residual, responsável, status, controles CIS vinculados e tarefas de tratamento com prazo.
- **Relatório & export** — tabela consolidada da avaliação e export em JSON.
- **Configurações** — SSO (SAML) configurável pela própria aplicação (sem editar `.env` nem reiniciar), com fallback de conta local de emergência.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | NestJS (Node 20) + TypeScript |
| Banco | PostgreSQL 16 + Prisma ORM |
| Autenticação | SAML 2.0 (`@node-saml/node-saml`) dinâmico + sessão em cookie (Postgres) |
| Proxy / TLS | Nginx + Let's Encrypt (certbot) |
| Empacotamento | Docker + Docker Compose |

Arquitetura detalhada em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
Deploy em Ubuntu em [`docs/DEPLOY-UBUNTU.md`](docs/DEPLOY-UBUNTU.md).
Configuração do SSO em [`docs/SAML.md`](docs/SAML.md).

## Deploy em produção (Ubuntu)

Instalação automatizada — instala pré-requisitos (Docker, Nginx, Certbot), pergunta a configuração necessária, sobe a stack e (se você informar um domínio) já deixa TLS configurado:

```bash
git clone https://github.com/khafirovisk/cis-risk_monitor.git sentinela-cis
cd sentinela-cis
sudo ./install.sh
```

Detalhes e o passo a passo manual em [`docs/DEPLOY-UBUNTU.md`](docs/DEPLOY-UBUNTU.md).

## Atualizando para uma nova versão

Depois que uma atualização for enviada para o repositório (`git push`), atualize
o servidor de produção rodando, na pasta onde o app foi instalado:

```bash
cd sentinela-cis          # pasta onde o install.sh clonou o repositório
git pull
docker compose up -d --build       # reconstrói e reinicia api/web com o código novo
docker compose exec api npx prisma migrate deploy   # aplica migrations pendentes, se houver
```

- Isso não apaga dados do banco — só reconstrói as imagens da aplicação e aplica
  migrations novas (se o release trouxer alguma mudança de schema).
- Sessões ativas dos usuários **não são derrubadas** automaticamente. Se a
  atualização mudar algo no frontend, o navegador de quem já estava logado só
  vai carregar os arquivos novos ao recarregar a página (F5) — não existe hoje
  um mecanismo de auto-atualização/aviso dentro do app; se isso virar um
  problema recorrente, vale revisitar.
- Para conferir se subiu a versão certa depois do `git pull`: `git log -1
  --oneline` deve mostrar o commit esperado, e `docker compose ps` deve
  mostrar os 3 containers (`postgres`, `api`, `web`) com status `Up`/healthy.

## Rodando localmente (Docker)

```bash
cp .env.example .env            # ajuste segredos e SAML
docker compose up -d --build    # sobe postgres + api + web
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed   # carrega os 18 controles / 153 salvaguardas
```

- Web: http://localhost:8080
- API: http://localhost:8080/api
- Health: http://localhost:8080/api/health
- Login local de emergência: usuário `admin`, senha `admin` (troca obrigatória no 1º acesso). SSO configurável em Configurações → SSO (SAML).

## Rodando sem Docker (desenvolvimento)

```bash
# banco
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16

# backend
cd backend && cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run start:dev            # http://localhost:3000

# frontend (outro terminal)
cd frontend && cp .env.example .env
npm install
npm run dev                  # http://localhost:5173
```

## Testes

```bash
cd backend && npm test        # Jest — controllers e services
cd frontend && npx tsc        # type-check (sem framework de teste no frontend)
```

## Estrutura

```
sentinela-cis/
├── backend/        API NestJS + Prisma (controles, avaliações, riscos, evidências, auth SAML)
├── frontend/       SPA React + Vite (dashboard, auditoria, riscos, relatório, configurações)
├── infra/          Nginx e unit systemd
├── docs/           Arquitetura, deploy, SAML e o protótipo original
├── install.sh      Instalador automatizado para Ubuntu Server
└── docker-compose.yml
```

## Licença

Uso interno. Ajuste conforme a política da sua organização.
