#!/usr/bin/env bash
# Run as root on the app server (Debian 12).
# Usage: bash setup-appserver.sh
set -euo pipefail

APP_DIR=/srv/galleri
APP_USER=galleri
LOG_DIR=/var/log/galleri

echo "==> Installing system packages"
apt-get update -qq
apt-get install -y python3 python3-venv python3-pip libmagic1 git

echo "==> Creating system user: $APP_USER"
id "$APP_USER" &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"

echo "==> Creating directories"
mkdir -p "$APP_DIR" "$LOG_DIR"
chown "$APP_USER:$APP_USER" "$LOG_DIR"

echo "==> Cloning / updating repo"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  # Replace with your actual repo URL when ready
  echo "  (place repo at $APP_DIR manually or via git clone)"
fi

echo "==> Setting up Python virtualenv"
python3 -m venv "$APP_DIR/venv"
"$APP_DIR/venv/bin/pip" install --quiet --upgrade pip
"$APP_DIR/venv/bin/pip" install --quiet -r "$APP_DIR/requirements.txt"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/venv"

echo "==> Securing .env"
if [ -f "$APP_DIR/.env" ]; then
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
  chmod 640 "$APP_DIR/.env"
else
  echo "  WARNING: $APP_DIR/.env not found. Copy .env.example and fill in values."
fi

echo "==> Installing systemd service"
cp "$APP_DIR/deploy/galleri.service" /etc/systemd/system/galleri.service
systemctl daemon-reload
systemctl enable galleri
systemctl restart galleri
systemctl status galleri --no-pager

echo "==> Installing Nginx config"
cp "$APP_DIR/deploy/nginx-galleri.conf" /etc/nginx/sites-available/galleri
ln -sf /etc/nginx/sites-available/galleri /etc/nginx/sites-enabled/galleri
nginx -t && systemctl reload nginx

echo ""
echo "Done. Check 'journalctl -u galleri -f' for application logs."
