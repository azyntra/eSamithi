#!/usr/bin/env bash
# Deploy A — bring the production API up to the version the web app needs.
#
# What changes: the new staff-session endpoints (/auth/session, /auth/refresh,
# /auth/logout, /auth/me, /auth/sessions, /auth/change-password), migrations
# 014 and 015 (both additive and guarded), the password library's dual verify,
# trust proxy, the staff rate limiters and the env-gated CORS allow-list.
# What does NOT change: POST /auth/login answers byte-for-byte as before, the
# DEFAULT_TENANT header-less fallback stays, JWT_SECRET is never rotated, and
# passwords are still written as sha256 until PASSWORD_REHASH=on (Deploy B).
#
# The only interruption is the api container swap, a few seconds. Everything
# before it — backup, staging, image build, migrations — runs while the old
# container keeps serving. Migrations are additive, so the running old code is
# unaffected by them.
#
#   CONFIRM=deploy-a bash deploy/prod/deploy-api.sh          # the real thing
#   bash deploy/prod/deploy-api.sh                           # dry run, no CONFIRM
#   ROLLBACK=<timestamp> CONFIRM=deploy-a bash deploy/prod/deploy-api.sh
#
# Announce a window first: a counter mid-receipt will see one failed request.
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

HOST="${HOST:-ubuntu@141.147.75.132}"
KEY="${KEY:-$HOME/.ssh/esamithi_prod}"
STACK=/opt/esamithi-stack
CODE=/opt/esamithi-server
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST")
STAMP="$(date +%Y%m%d-%H%M%S)"
DRY=1
[ "${CONFIRM:-}" = "deploy-a" ] && DRY=0

say() { printf '\n\033[1m── %s\033[0m\n' "$*"; }
remote() { if [ "$DRY" = "1" ]; then echo "DRY: ssh $HOST '$1'"; else "${SSH[@]}" "$1"; fi; }

if [ "$DRY" = "1" ]; then
  printf '\033[33mDRY RUN — nothing will change. Re-run with CONFIRM=deploy-a to apply.\033[0m\n'
fi

# ── Rollback ────────────────────────────────────────────────────────────────
if [ -n "${ROLLBACK:-}" ]; then
  say "Rolling back the API to $ROLLBACK"
  remote "set -e
    test -d '$CODE.bak-$ROLLBACK' || { echo 'no such backup'; exit 1; }
    sudo rm -rf '$CODE.rollback-tmp' && sudo cp -a '$CODE' '$CODE.rollback-tmp'
    sudo rsync -a --delete --exclude uploads '$CODE.bak-$ROLLBACK/' '$CODE/'
    cd '$STACK' && sudo docker compose up -d --build api
    sleep 8 && sudo docker compose ps api"
  echo "Tables added by 014/015 stay behind; the old code ignores them."
  exit 0
fi

# ── 1. Pre-flight ───────────────────────────────────────────────────────────
say "Pre-flight"
echo "repo HEAD:        $(git rev-parse --short HEAD)  $(git log -1 --format=%s | cut -c1-60)"
echo "uncommitted:      $(git status --porcelain -- server | wc -l | tr -d ' ') file(s) under server/"
echo -n "prod api_version: "; curl -s --max-time 15 https://api.esamithi.com/api/v1/health | tr -d '\n'; echo
echo -n "testbed version:  "; curl -s --max-time 15 https://console.esamithi.com/api/v1/health | tr -d '\n'; echo
remote "df -h / | tail -1; sudo docker ps --format '{{.Names}} {{.Status}}'"

# ── 2. Backup: database first, then the code that reads it ──────────────────
say "Backup (mysqldump of every tenant + a copy of the server code)"
remote "set -e
  sudo mkdir -p /opt/esamithi-backups
  sudo docker exec esamithi-stack-mysql-1 sh -c 'exec mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --all-databases --single-transaction --routines --triggers --set-gtid-purged=OFF' \
    | gzip > /tmp/prod-all-$STAMP.sql.gz
  sudo mv /tmp/prod-all-$STAMP.sql.gz /opt/esamithi-backups/
  ls -lh /opt/esamithi-backups/prod-all-$STAMP.sql.gz
  sudo cp -a '$CODE' '$CODE.bak-$STAMP'
  echo 'code copied to $CODE.bak-$STAMP'"
echo "Rollback handle: ROLLBACK=$STAMP"

# ── 3. Stage the new code (old container still serving) ─────────────────────
say "Staging server code"
if [ "$DRY" = "1" ]; then
  echo "DRY: tar server/ -> $CODE (excluding node_modules, .env, uploads, tenants.json)"
else
  tar -C server -czf - --exclude node_modules --exclude .env --exclude uploads --exclude tenants.json . \
    | "${SSH[@]}" "sudo tar -C '$CODE' -xzf -"
  "${SSH[@]}" "sudo ls -la '$CODE' | head -5"
fi

# ── 4. Build the image before anything stops ────────────────────────────────
say "Building the new image (no interruption yet)"
remote "cd '$STACK' && sudo docker compose build api"

# ── 5. Migrations, from a throwaway container of the new image ──────────────
say "Migrations 014 + 015 (additive, guarded; the live container is untouched)"
remote "cd '$STACK' && sudo docker compose run --rm --no-deps api node migrate.js"

# ── 6. The only interrupting step ───────────────────────────────────────────
say "Swapping the api container (seconds)"
remote "cd '$STACK' && sudo docker compose up -d --no-deps api && sleep 10 && sudo docker compose ps api"

# ── 7. Smoke ────────────────────────────────────────────────────────────────
say "Smoke"
if [ "$DRY" = "1" ]; then echo "DRY: would smoke both hosts"; exit 0; fi
h=$(curl -s --max-time 20 https://api.esamithi.com/api/v1/health); echo "health:            $h"
case "$h" in *api_version*) echo "  ✓ new code is serving";; *) echo "  ✗ still the old build";; esac
echo -n "desktop contract:  "; curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
  -H 'Content-Type: application/json' -H 'X-Samithi: samithi01' \
  -d '{"username":"deploy-smoke-not-a-user","password":"x"}' https://api.esamithi.com/api/v1/auth/login; echo "  (401 expected, never 404)"
echo -n "web session:       "; curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
  -H 'Content-Type: application/json' -H 'X-Samithi: samithi01' -H 'X-Requested-With: eSamithi' \
  -d '{"username":"deploy-smoke-not-a-user","password":"x"}' https://app.esamithi.com/api/v1/auth/session; echo "  (401 expected — 404 means the endpoint is missing)"
echo -n "refresh w/o cookie:"; curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
  -H 'X-Requested-With: eSamithi' -H 'X-Samithi: samithi01' https://app.esamithi.com/api/v1/auth/refresh; echo "  (401 expected)"
echo -n "mobile + updates:  "; curl -s -o /dev/null -w '%{http_code} ' --max-time 20 http://141.147.75.132/api/v1/health; \
  curl -s -o /dev/null -w '%{http_code}\n' --max-time 20 https://api.esamithi.com/updates/latest.yml

say "Watch for 30 minutes"
cat <<WATCH
  ssh $HOST 'cd $STACK && sudo docker compose logs -f --tail=50 api'
  ssh $HOST 'sudo docker exec esamithi-stack-nginx-1 tail -f /var/log/nginx/error.log'
  Sign in on https://app.esamithi.com, then check Settings → Security lists the session.
  Have the office sign in on desktop 1.3.7 once and record one receipt.
  Anything wrong: ROLLBACK=$STAMP CONFIRM=deploy-a bash deploy/prod/deploy-api.sh
WATCH
