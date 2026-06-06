#!/usr/bin/env bash
set -euo pipefail

cd /srv/galleri
git pull

cp deploy/nginx-galleri.conf /etc/nginx/sites-available/galleri
nginx -t
systemctl reload nginx

systemctl restart galleri
echo "Deploy complete."
