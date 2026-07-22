#!/usr/bin/env bash
# Instalador do Sentinela CIS em Ubuntu Server (22.04/24.04).
# Cobre: pré-requisitos, tela de configuração (.env), stack Docker Compose,
# migrations + seed, e (opcional) Nginx + HTTPS via certbot.
#
# Uso:
#   sudo ./install.sh
#
# Reexecutável: se o .env já existir, a tela de configuração é pulada; os
# demais passos (docker compose, migrate, seed) são idempotentes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$REPO_ROOT/.env"
NGINX_TEMPLATE="$REPO_ROOT/infra/nginx/nginx.conf"
NGINX_SELFSIGNED_TEMPLATE="$REPO_ROOT/infra/nginx/nginx-selfsigned.conf"
NGINX_SITE="/etc/nginx/sites-available/sentinela-cis"
DEPLOY_DOMAIN=""
TLS_METHOD=""   # "letsencrypt" | "selfsigned" | "" (sem TLS)

# ---------- helpers ----------
c_reset='\033[0m'; c_bold='\033[1m'; c_green='\033[32m'; c_yellow='\033[33m'; c_red='\033[31m'
info()  { printf "${c_bold}${c_green}==>${c_reset} %s\n" "$1"; }
warn()  { printf "${c_bold}${c_yellow}!!${c_reset} %s\n" "$1"; }
fail()  { printf "${c_bold}${c_red}xx${c_reset} %s\n" "$1"; exit 1; }

ask() { # ask "pergunta" "default" -> imprime resposta no stdout
  local prompt="$1" default="${2:-}" answer
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " answer || true
    echo "${answer:-$default}"
  else
    read -r -p "$prompt: " answer || true
    echo "$answer"
  fi
}

ask_secret() { # gera um valor aleatório se o usuário não digitar nada
  local prompt="$1" answer
  read -r -p "$prompt [Enter para gerar automaticamente]: " answer || true
  if [ -z "$answer" ]; then
    openssl rand -hex 24
  else
    echo "$answer"
  fi
}

require_root() {
  if [ "$(id -u)" -ne 0 ]; then
    fail "Rode como root (sudo ./install.sh) — precisa instalar pacotes de sistema."
  fi
}

# ---------- 1. pré-requisitos ----------
install_prereqs() {
  info "Instalando pré-requisitos (git, curl, ca-certificates, openssl)..."
  apt-get update -qq
  apt-get install -y -qq git ca-certificates curl openssl >/dev/null

  if ! command -v docker >/dev/null 2>&1; then
    info "Instalando Docker Engine + Compose plugin..."
    curl -fsSL https://get.docker.com | sh
  else
    info "Docker já instalado ($(docker --version))."
  fi

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose plugin não encontrado após a instalação do Docker. Instale manualmente e rode de novo."
  fi
}

# ---------- 2. tela de configuração ----------
configure_env() {
  if [ -f "$ENV_FILE" ]; then
    info ".env já existe em $ENV_FILE — pulando a tela de configuração."
    echo "   (apague o arquivo e rode de novo se quiser reconfigurar do zero)"
    # deriva o domínio do APP_BASE_URL existente, se houver, para os passos
    # de Nginx/TLS e do resumo final também funcionarem numa reexecução
    local existing_base_url
    existing_base_url=$(grep '^APP_BASE_URL=' "$ENV_FILE" | cut -d= -f2-)
    case "$existing_base_url" in
      https://*) DEPLOY_DOMAIN="${existing_base_url#https://}" ;;
      http://localhost*|"") DEPLOY_DOMAIN="" ;;
      *) DEPLOY_DOMAIN="" ;;
    esac
    return
  fi

  echo
  printf "${c_bold}=== Configuração do Sentinela CIS ===${c_reset}\n"
  echo "Deixe em branco os campos opcionais (SAML) — dá pra configurar depois"
  echo "pela própria aplicação, em Configurações → SSO (SAML)."
  echo

  local domain postgres_user postgres_password postgres_db session_secret app_base_url

  domain=$(ask "Domínio de produção (ex.: grc.leomadeiras.com.br) — em branco para acessar só por IP:porta 8080" "")
  if [ -n "$domain" ]; then
    app_base_url="https://$domain"
  else
    app_base_url=$(ask "APP_BASE_URL (URL completa de acesso)" "http://localhost:8080")
  fi

  postgres_user=$(ask "Usuário do Postgres" "sentinela")
  postgres_db=$(ask "Nome do banco Postgres" "sentinela")
  postgres_password=$(ask_secret "Senha do Postgres")
  session_secret=$(ask_secret "SESSION_SECRET (segredo de sessão)")

  echo
  echo "SAML (opcional agora — pode configurar depois pela tela de Configurações):"
  local saml_entry_point saml_issuer saml_idp_cert saml_callback_url
  saml_entry_point=$(ask "SAML_ENTRY_POINT (URL de login do IdP)" "")
  saml_issuer=$(ask "SAML_ISSUER (Entity ID / Issuer)" "sentinela-cis")
  saml_idp_cert=$(ask "SAML_IDP_CERT (certificado X.509 do IdP, base64 em uma linha)" "")
  saml_callback_url=""
  if [ -n "$domain" ]; then
    saml_callback_url="https://$domain/api/auth/saml/callback"
  fi

  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
POSTGRES_USER=$postgres_user
POSTGRES_PASSWORD=$postgres_password
POSTGRES_DB=$postgres_db
DATABASE_URL=postgresql://$postgres_user:$postgres_password@postgres:5432/$postgres_db
APP_BASE_URL=$app_base_url
SESSION_SECRET=$session_secret
SAML_ENTRY_POINT=$saml_entry_point
SAML_ISSUER=$saml_issuer
SAML_IDP_CERT=$saml_idp_cert
SAML_CALLBACK_URL=$saml_callback_url
EOF
  chmod 600 "$ENV_FILE"
  info ".env criado em $ENV_FILE"

  # usado pelos passos seguintes desta execução (não persiste em disco além do .env)
  DEPLOY_DOMAIN="$domain"
}

# ---------- 3. stack Docker ----------
deploy_stack() {
  info "Subindo a stack (build pode demorar alguns minutos na primeira vez)..."
  cd "$REPO_ROOT"
  docker compose up -d --build

  info "Aguardando o Postgres ficar saudável..."
  local tries=0
  until docker compose exec -T postgres pg_isready -U "$(grep ^POSTGRES_USER= "$ENV_FILE" | cut -d= -f2)" >/dev/null 2>&1; do
    tries=$((tries + 1))
    if [ "$tries" -gt 30 ]; then
      fail "Postgres não ficou saudável a tempo. Veja: docker compose logs postgres"
    fi
    sleep 2
  done

  info "Aplicando migrations..."
  docker compose exec -T api npx prisma migrate deploy

  info "Rodando seed (catálogo CIS + conta local de emergência)..."
  docker compose exec -T api npm run seed
}

# ---------- 4. Nginx + TLS (opcional) ----------
setup_nginx_tls() {
  local domain="${DEPLOY_DOMAIN:-}"
  if [ -z "$domain" ]; then
    warn "Nenhum domínio informado — pulando Nginx/TLS. App acessível em http://<ip-do-servidor>:8080"
    return
  fi

  info "Instalando Nginx..."
  apt-get install -y -qq nginx >/dev/null

  echo
  echo "Certificado TLS para $domain:"
  echo "  1) Let's Encrypt (Certbot) — precisa de DNS público já apontando pro servidor [padrão]"
  echo "  2) Autoassinado — funciona sem DNS público; o navegador vai mostrar aviso de"
  echo "     \"conexão não segura\" até você trocar por um certificado real depois"
  local tls_choice
  tls_choice=$(ask "Escolha (1 ou 2)" "1")

  if [ "$tls_choice" = "2" ]; then
    setup_nginx_selfsigned "$domain"
  else
    setup_nginx_letsencrypt "$domain"
  fi
}

setup_nginx_letsencrypt() {
  local domain="$1"
  TLS_METHOD="letsencrypt"

  info "Instalando Certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx >/dev/null

  info "Configurando site Nginx para $domain..."
  sed "s/grc\.suaempresa\.com\.br/$domain/" "$NGINX_TEMPLATE" > "$NGINX_SITE"
  ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/sentinela-cis"
  nginx -t
  systemctl reload nginx

  local email
  email=$(ask "E-mail para avisos do Let's Encrypt (Enter para pular e configurar TLS manualmente depois)" "")
  if [ -n "$email" ]; then
    info "Emitindo certificado TLS via certbot..."
    certbot --nginx -d "$domain" --non-interactive --agree-tos -m "$email" --redirect
  else
    warn "Certbot não executado (sem e-mail). Rode manualmente depois:"
    echo "   sudo certbot --nginx -d $domain"
  fi
}

setup_nginx_selfsigned() {
  local domain="$1"
  TLS_METHOD="selfsigned"
  local cert_dir="/etc/nginx/ssl/$domain"

  info "Gerando certificado autoassinado para $domain (validade: 10 anos)..."
  mkdir -p "$cert_dir"
  chmod 700 "$cert_dir"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$cert_dir/privkey.pem" \
    -out "$cert_dir/fullchain.pem" \
    -subj "/CN=$domain" \
    -addext "subjectAltName=DNS:$domain" >/dev/null 2>&1
  chmod 600 "$cert_dir/privkey.pem"

  info "Configurando site Nginx (TLS autoassinado) para $domain..."
  sed "s/grc\.suaempresa\.com\.br/$domain/g" "$NGINX_SELFSIGNED_TEMPLATE" > "$NGINX_SITE"
  ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/sentinela-cis"
  nginx -t
  systemctl reload nginx

  warn "Certificado autoassinado — navegadores vão mostrar aviso de \"conexão não segura\"."
  echo "   Quando tiver um DNS público apontando pra este servidor, rode"
  echo "   'sudo ./install.sh' de novo e escolha a opção 1 (Let's Encrypt) para trocar."
}

# ---------- 5. status final ----------
print_status() {
  echo
  printf "${c_bold}=== Status do deploy ===${c_reset}\n"
  docker compose -f "$REPO_ROOT/docker-compose.yml" ps

  echo
  local health_url="http://localhost:8080/api/health"
  if curl -sf "$health_url" >/dev/null 2>&1; then
    info "API respondendo em $health_url"
  else
    warn "API não respondeu em $health_url — confira: docker compose logs api"
  fi

  echo
  if [ -n "${DEPLOY_DOMAIN:-}" ]; then
    printf "Acesse: ${c_bold}https://%s${c_reset}\n" "$DEPLOY_DOMAIN"
    if [ "${TLS_METHOD:-}" = "selfsigned" ]; then
      warn "Certificado autoassinado em uso — navegador vai avisar \"conexão não segura\" até trocar por um certificado real (veja instruções acima)."
    fi
  else
    printf "Acesse: ${c_bold}http://<ip-do-servidor>:8080${c_reset}\n"
  fi
  echo "Login local de emergência: usuário 'admin', senha 'admin' (troca obrigatória no 1º acesso)."
  echo "Configure o SSO (SAML) pela própria aplicação em: Configurações → SSO (SAML)."
  echo
  echo "Backup do banco:  docker compose exec postgres pg_dump -U \$POSTGRES_USER \$POSTGRES_DB > backup.sql"
  echo "Atualizar depois: git pull && docker compose up -d --build && docker compose exec api npx prisma migrate deploy"
}

# ---------- main ----------
main() {
  require_root
  install_prereqs
  configure_env
  deploy_stack
  setup_nginx_tls
  print_status
}

main "$@"
