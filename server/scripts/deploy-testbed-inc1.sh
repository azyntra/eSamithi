#!/usr/bin/env bash
# Deploy Increment 1 (multi-samithi tenant plumbing) to the TESTBED (pm2).
# Run from the repo root:  bash server/scripts/deploy-testbed-inc1.sh
# Two password prompts: one for the file copy, one for the remote steps.
set -euo pipefail

HOST="${HOST:-root@212.227.103.150}"
REMOTE_DIR=/opt/server

cd "$(dirname "$0")/../.."   # repo root

echo "── 1/2 Copying changed files"
tar -C server -cf - \
  db.js server.js migrate.js tenants.json \
  middleware/tenant.js middleware/auth.js middleware/memberAuth.js \
  routes/auth.routes.js routes/memberAuth.routes.js routes/puruka.routes.js \
  scripts/provision-tenant.js scripts/smoke-tenants.sh \
  | ssh "$HOST" "tar -C $REMOTE_DIR -xf -"

echo "── 2/2 Remote setup (default tenant, demo02 provision, uploads move, restart)"
ssh "$HOST" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/server

# Legacy clients (no X-Samithi header) keep working via the default tenant
grep -q '^DEFAULT_TENANT=' .env || echo 'DEFAULT_TENANT=test01' >> .env

# Second tenant for cross-samithi isolation testing (idempotent-ish: skips if present)
if grep -q '"demo02"' tenants.json && mysql -u"$(grep '^DB_USER=' .env | cut -d= -f2)" \
     -p"$(grep '^DB_PASSWORD=' .env | cut -d= -f2)" -e 'USE esamithi_demo02' 2>/dev/null; then
  echo "demo02 already provisioned — skipping"
else
  node scripts/provision-tenant.js demo02 "Demo Samithi" \
    || echo "!! provision failed — check DB privileges (may need DB_ADMIN_USER/DB_ADMIN_PASSWORD)"
fi

# Photos move under their tenant: uploads/puruka → uploads/test01/puruka
if [ -d uploads/puruka ]; then
  mkdir -p uploads/test01
  mv uploads/puruka uploads/test01/puruka
  echo "uploads moved to uploads/test01/puruka"
fi

pm2 restart esamithi-api
sleep 3
pm2 status esamithi-api
pm2 logs esamithi-api --nostream --lines 12
REMOTE

echo
echo "Done. IMPORTANT: the demo02 admin password was printed once above — save it."
echo "Now verify isolation:"
echo "  T1_PASS=<test01 admin pw> T2_PASS=<demo02 admin pw> bash server/scripts/smoke-tenants.sh"
