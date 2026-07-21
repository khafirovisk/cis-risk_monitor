# Sentinela CIS

Plataforma web de **avaliação de maturidade CIS Controls v8.1.2** e **gestão de riscos** de segurança da informação.

> Evolução do protótipo em `docs/prototipo-demo.html` para uma aplicação multiusuário, com backend, banco de dados e SSO corporativo (SAML), pronta para rodar em **Ubuntu Server**.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Backend | NestJS (Node 20) + TypeScript |
| Banco | PostgreSQL 16 + Prisma ORM |
| Autenticação | SAML 2.0 (`@node-saml/passport-saml`) + sessão em cookie |
| Proxy / TLS | Nginx + Let's Encrypt (certbot) |
| Empacotamento | Docker + Docker Compose |

Arquitetura detalhada em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).
Deploy em Ubuntu em [`docs/DEPLOY-UBUNTU.md`](docs/DEPLOY-UBUNTU.md).
Configuração do SSO em [`docs/SAML.md`](docs/SAML.md).

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

## Estrutura

```
sentinela-cis/
├── backend/        API NestJS + Prisma (controles, avaliações, riscos, auth SAML)
├── frontend/       SPA React + Vite (dashboard, auditoria, riscos)
├── infra/          Nginx e unit systemd
├── docs/           Arquitetura, deploy, SAML e o protótipo original
└── docker-compose.yml
```

## Licença

Uso interno. Ajuste conforme a política da sua organização.
