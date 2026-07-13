#!/usr/bin/env bash
# CI end-to-end: boots the real API against MySQL with two fake tenants and
# runs the cross-tenant smoke suite. Expects the DBs to exist and migrations
# to have run (the workflow does both via migrate.js).
set -euo pipefail
cd "$(dirname "$0")/.."   # server/

export DB_HOST="${DB_HOST:-127.0.0.1}"
export DB_USER="${DB_USER:-root}"
export DB_PASSWORD="${DB_PASSWORD:-citest}"
export JWT_SECRET=ci-test-secret
export DEFAULT_TENANT=ci1
export TENANTS_FILE="$PWD/test/fixtures/tenants.ci.json"
export PORT=3100

for db in esamithi_ci1 esamithi_ci2; do
  mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASSWORD" "$db" -e \
    "INSERT INTO users (username, password, full_name, role)
     VALUES ('admin', SHA2('ci-pass-$db', 256), 'CI Admin', 'admin')
     ON DUPLICATE KEY UPDATE password = VALUES(password);"
done

node server.js &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null && break
  sleep 1
done

BASE="http://127.0.0.1:$PORT/api/v1" T1=ci1 T2=ci2 \
T1_PASS="ci-pass-esamithi_ci1" T2_PASS="ci-pass-esamithi_ci2" \
bash scripts/smoke-tenants.sh
