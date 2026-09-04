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
apt-get install -y ca-certificates curl git nginx

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

cat > /etc/nginx/sites-available/linkponto <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    client_max_body_size 3M;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sfn /etc/nginx/sites-available/linkponto /etc/nginx/sites-enabled/linkponto
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo
echo "LINKPONTO_INSTALADO"
echo "Painel: http://$DOMAIN"
echo "Ponto:  http://$DOMAIN/ponto"
echo "Login inicial: admin / admin@123"
echo "Container: $(docker inspect -f '{{.State.Status}}' linkponto 2>/dev/null || echo indisponivel)"
