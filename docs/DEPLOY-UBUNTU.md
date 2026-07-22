# Deploy em Ubuntu Server (22.04/24.04)

## Instalação automatizada (recomendada)

```bash
git clone https://github.com/khafirovisk/cis-risk_monitor.git sentinela-cis
cd sentinela-cis
sudo ./install.sh
```

O script cuida de tudo: instala pré-requisitos (Docker, Nginx, Certbot),
mostra uma tela de configuração (domínio, senhas, segredos — pulada se já
existir um `.env`), sobe a stack, roda `migrate deploy` + `seed`, e —
se você informar um domínio — configura Nginx e emite o certificado TLS
automaticamente. Ao final, imprime o status do deploy e os próximos passos.
Reexecutável: rodar de novo com um `.env` existente só reaplica migrations
e reinicia os containers, sem repetir a tela de configuração.

Os passos manuais abaixo continuam documentados para quem preferir rodar
cada etapa na mão ou entender o que o script faz por baixo.

---

## Passo a passo manual

Duas opções: **A) Docker Compose** (recomendada) ou **B) systemd + Nginx nativo**.

---

## A) Docker Compose (recomendada)

### 1. Pré-requisitos
```bash
sudo apt update && sudo apt -y install git ca-certificates curl
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. Código e variáveis
```bash
git clone https://github.com/SUA_ORG/sentinela-cis.git
cd sentinela-cis
cp .env.example .env
# edite .env: senhas, APP_BASE_URL, SESSION_SECRET e bloco SAML_*
nano .env
```

### 3. Subir
```bash
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run seed
docker compose ps
```
A aplicação sobe na porta `8080` (contêiner `web`). Coloque um Nginx/HTTPS na frente (passo 5).

### 4. Atualizações
```bash
git pull && docker compose up -d --build
docker compose exec api npx prisma migrate deploy
```

### 5. Nginx + TLS na frente (host)
```bash
sudo apt -y install nginx
sudo cp infra/nginx/nginx.conf /etc/nginx/sites-available/sentinela
sudo ln -s /etc/nginx/sites-available/sentinela /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
# TLS
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d grc.suaempresa.com.br
```
Ajuste `server_name` e o `proxy_pass` (para `http://127.0.0.1:8080`) no `nginx.conf`.

### 6. Backup
```bash
docker compose exec postgres pg_dump -U sentinela sentinela > backup-$(date +%F).sql
docker run --rm -v sentinela-cis_uploads:/u -v $PWD:/b alpine tar czf /b/uploads-$(date +%F).tgz -C /u .
```

---

## B) systemd + Nginx nativo (sem Docker)

```bash
sudo apt update
sudo apt -y install nginx postgresql
# Node 20 (nodesource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs

# Banco
sudo -u postgres psql -c "CREATE USER sentinela WITH PASSWORD 'senha';"
sudo -u postgres psql -c "CREATE DATABASE sentinela OWNER sentinela;"

# App
sudo git clone https://github.com/SUA_ORG/sentinela-cis.git /opt/sentinela
cd /opt/sentinela/backend
cp .env.example .env && nano .env
npm ci && npm run build
npx prisma migrate deploy && npm run seed

# Frontend (build estático servido pelo Nginx)
cd /opt/sentinela/frontend
cp .env.example .env && nano .env   # VITE_API_URL=/api
npm ci && npm run build             # gera frontend/dist

# Serviço da API
sudo cp /opt/sentinela/infra/systemd/sentinela-backend.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sentinela-backend

# Nginx serve frontend/dist e faz proxy /api -> 127.0.0.1:3000
sudo cp /opt/sentinela/infra/nginx/nginx.conf /etc/nginx/sites-available/sentinela
sudo ln -s /etc/nginx/sites-available/sentinela /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d grc.suaempresa.com.br
```

> No modo nativo, ajuste o `root` do Nginx para `/opt/sentinela/frontend/dist` e o `proxy_pass` para `http://127.0.0.1:3000`.

## Verificação
- `https://grc.suaempresa.com.br/api/health` → `{ "status": "ok" }`
- Acesse a raiz → deve redirecionar para o SSO (SAML).
