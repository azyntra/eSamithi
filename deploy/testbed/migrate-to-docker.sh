#!/usr/bin/env bash
# One-time cutover of the TESTBED from pm2 + host MySQL to the Docker stack.
# Run ON the server, from /opt/esamithi:   bash migrate-to-docker.sh
#
# What it does, in order:
#   1. builds the API image while pm2 still serves traffic
#   2. generates the stack .env (new MySQL root + per-tenant app passwords)
#   3. stops pm2 + host nginx (downtime starts — testbed only)
#   4. dumps tenant DBs from host MySQL and imports them into container MySQL,
#      each owned by its own MySQL user (test01_app / demo02_app)
#   5. starts the full stack and health-checks it
#
# ROLLBACK at any point:
#   docker compose down && systemctl start nginx && pm2 restart esamithi-api
#   (/opt/server and host MySQL are never modified by this script)
set -euo pipefail
cd "$(dirname "$0")"
SRC=/opt/server

command -v docker >/dev/null || { echo "Docker missing — install first: curl -fsSL https://get.docker.com | sh"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose plugin missing (apt install docker-compose-plugin)"; exit 1; }
[ -f "$SRC/Dockerfile" ] || { echo "$SRC/Dockerfile missing — run deploy-testbed-inc2.sh from your machine first"; exit 1; }

get() { grep "^$1=" "$SRC/.env" | head -1 | cut -d= -f2-; }
HOST_DB_USER=$(get DB_USER); HOST_DB_PASS=$(get DB_PASSWORD)

echo "── 1/5 Building API image (pm2 still serving)"
docker compose build api

echo "── 2/5 Stack .env + tenants.json"
if [ -f .env ]; then
  echo ".env exists — reusing existing passwords (re-run)"
else
  MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
  TEST01_DB_PASSWORD=$(openssl rand -hex 12)
  DEMO02_DB_PASSWORD=$(openssl rand -hex 12)
  # Carry everything from the pm2 env except host-MySQL specifics
  grep -vE '^(DB_HOST|DB_USER|DB_PASSWORD|DB_NAME)=' "$SRC/.env" > .env
  {
    echo "DB_HOST=mysql"
    echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD"
    echo "TEST01_DB_PASSWORD=$TEST01_DB_PASSWORD"
    echo "DEMO02_DB_PASSWORD=$DEMO02_DB_PASSWORD"
  } >> .env
  grep -q '^DEFAULT_TENANT=' .env || echo 'DEFAULT_TENANT=test01' >> .env
  chmod 600 .env
fi
ROOT_PW=$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)
T1_PW=$(grep '^TEST01_DB_PASSWORD=' .env | cut -d= -f2-)
T2_PW=$(grep '^DEMO02_DB_PASSWORD=' .env | cut -d= -f2-)

# Stack tenants.json points each samithi at its own MySQL user; the pm2 copy
# in /opt/server stays untouched so rollback keeps working.
node -e "
const fs = require('fs');
const t = JSON.parse(fs.readFileSync('$SRC/tenants.json', 'utf-8'));
if (t.test01) Object.assign(t.test01, { db_user: 'test01_app', db_password_env: 'TEST01_DB_PASSWORD' });
if (t.demo02) Object.assign(t.demo02, { db_user: 'demo02_app', db_password_env: 'DEMO02_DB_PASSWORD' });
fs.writeFileSync('tenants.json', JSON.stringify(t, null, 2) + '\n');
"
mkdir -p updates
for d in /var/www/updates /var/www/html/updates /srv/updates; do
  [ -d "$d" ] && cp -rn "$d/." updates/ && echo "copied desktop update feed from $d"
done

echo "── 3/5 Stopping pm2 + host nginx (testbed downtime starts)"
pm2 stop esamithi-api || true
systemctl stop nginx || true
systemctl disable nginx || true   # container nginx owns :80 from now on

echo "── 4/5 Migrating databases into container MySQL"
mysqldump -u"$HOST_DB_USER" -p"$HOST_DB_PASS" --single-transaction --no-tablespaces esamithi > /tmp/dump-test01.sql
if mysql -u"$HOST_DB_USER" -p"$HOST_DB_PASS" -e 'USE esamithi_demo02' 2>/dev/null; then
  mysqldump -u"$HOST_DB_USER" -p"$HOST_DB_PASS" --single-transaction --no-tablespaces esamithi_demo02 > /tmp/dump-demo02.sql
fi

docker compose up -d mysql
echo "waiting for MySQL to accept root logins (init can take ~1 min on first run)..."
until docker compose exec -T mysql mysql -h127.0.0.1 -uroot -p"$ROOT_PW" -e 'SELECT 1' >/dev/null 2>&1; do sleep 3; done

docker compose exec -T mysql mysql -uroot -p"$ROOT_PW" <<SQL
CREATE DATABASE IF NOT EXISTS esamithi        CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS esamithi_demo02 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'test01_app'@'%' IDENTIFIED BY '$T1_PW';
ALTER USER 'test01_app'@'%' IDENTIFIED BY '$T1_PW';
GRANT ALL PRIVILEGES ON esamithi.* TO 'test01_app'@'%';
CREATE USER IF NOT EXISTS 'demo02_app'@'%' IDENTIFIED BY '$T2_PW';
ALTER USER 'demo02_app'@'%' IDENTIFIED BY '$T2_PW';
GRANT ALL PRIVILEGES ON esamithi_demo02.* TO 'demo02_app'@'%';
FLUSH PRIVILEGES;
SQL

docker compose exec -T mysql mysql -uroot -p"$ROOT_PW" esamithi < /tmp/dump-test01.sql
[ -f /tmp/dump-demo02.sql ] && docker compose exec -T mysql mysql -uroot -p"$ROOT_PW" esamithi_demo02 < /tmp/dump-demo02.sql
rm -f /tmp/dump-test01.sql /tmp/dump-demo02.sql
echo "✓ databases imported (per-tenant MySQL users in place)"

echo "── 5/5 Starting the stack"
docker compose up -d
sleep 8
docker compose ps
echo
curl -s "http://localhost/api/v1/health?deep=1" && echo
echo
echo "Done. Verify from your machine:"
echo "  T1_PASS=... T2_PASS=... bash server/scripts/smoke-tenants.sh"
echo "Rollback if needed: docker compose down && systemctl enable --now nginx && pm2 restart esamithi-api"
