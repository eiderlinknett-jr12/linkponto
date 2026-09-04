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

if [ ! -f "$APP_DIR/.env" ]; then
  AUTH_SECRET="$(openssl rand -hex 32)"
  cat > "$APP_DIR/.env" <<EOF
ADMIN_USER=admin
ADMIN_PASSWORD=admin@123
AUTH_SECRET=$AUTH_SECRET
EOF
  chmod 600 "$APP_DIR/.env"
fi

cd "$APP_DIR"
docker compose up -d --build

echo
echo "LINKPONTO_INSTALADO"
echo "Painel: https://$DOMAIN"
echo "Ponto:  https://$DOMAIN/ponto"
echo "Login inicial: admin / admin@123"
echo "Container: $(docker inspect -f '{{.State.Status}}' linkponto 2>/dev/null || echo indisponivel)"
