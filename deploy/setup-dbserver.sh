#!/usr/bin/env bash
# Run as root on the DB server (Debian 12).
# Usage: bash setup-dbserver.sh <app_server_private_ip>
set -euo pipefail

APP_IP="${1:?Usage: $0 <app_server_private_ip>}"

echo "==> Installing PostgreSQL"
apt-get update -qq
apt-get install -y postgresql postgresql-contrib

PG_VERSION=$(pg_lsclusters -h | awk 'NR==1{print $1}')
PG_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
HBA_CONF="/etc/postgresql/$PG_VERSION/main/pg_hba.conf"

echo "==> Binding PostgreSQL to private IP only"
# Replace listen_addresses
sed -i "s/^#*listen_addresses\s*=.*/listen_addresses = '127.0.0.1,$APP_IP'/" "$PG_CONF"

echo "==> Creating database and role"
sudo -u postgres psql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'galleri_app') THEN
    CREATE ROLE galleri_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END
\$\$;

CREATE DATABASE galleri OWNER galleri_app;
SQL

echo "==> Configuring pg_hba.conf"
# Remove any existing galleri_app line, then append
sed -i '/galleri_app/d' "$HBA_CONF"
echo "host    galleri    galleri_app    $APP_IP/32    scram-sha-256" >> "$HBA_CONF"

echo "==> Restarting PostgreSQL"
systemctl restart postgresql

echo "==> Running initial migration"
sudo -u postgres psql -d galleri -f /tmp/001_initial.sql 2>/dev/null \
  || echo "  (copy migrations/001_initial.sql to /tmp/ on this server and re-run psql manually)"

echo ""
echo "Done."
echo "IMPORTANT: Change the galleri_app password from CHANGE_ME_STRONG_PASSWORD"
echo "  psql -U postgres -c \"ALTER ROLE galleri_app PASSWORD 'your-new-password';\""
