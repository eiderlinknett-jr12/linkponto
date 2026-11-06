#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${LINKPONTO_DOMAIN:-linkponto.linknett.com.br}"
APP_DIR="/opt/linkponto"
REPOSITORY="https://github.com/eiderlinknett-jr12/linkponto.git"

if [ "$(id -u)" -ne 0 ]; then
  exec sudo -E bash "$0" "$@"
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  mkdir -p "$APP_DIR"
  git clone --branch main "$REPOSITORY" "$APP_DIR"
fi

INITIAL_LOGIN=""
if [ ! -f "$APP_DIR/.env" ]; then
  AUTH_SECRET="$(openssl rand -hex 32)"
  GENERATED_ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -hex 12)}"
  cat > "$APP_DIR/.env" <<EOF
ADMIN_USER=admin
ADMIN_PASSWORD=$GENERATED_ADMIN_PASSWORD
AUTH_SECRET=$AUTH_SECRET
EOF
  chmod 600 "$APP_DIR/.env"
  INITIAL_LOGIN="Login inicial: admin / $GENERATED_ADMIN_PASSWORD"
fi

cd "$APP_DIR"
docker compose up -d --build

echo
echo "LINKPONTO_INSTALADO"
echo "Painel: https://$DOMAIN"
echo "Ponto:  https://$DOMAIN/ponto"
if [ -n "$INITIAL_LOGIN" ]; then echo "$INITIAL_LOGIN"; fi
echo "Container: $(docker inspect -f '{{.State.Status}}' linkponto 2>/dev/null || echo indisponivel)"
