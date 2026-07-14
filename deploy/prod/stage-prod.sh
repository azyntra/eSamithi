#!/usr/bin/env bash
# Stage the prod server BEFORE the cutover window (safe while pm2 serves):
# copies the current multi-tenant server code + this stack dir to prod and
# pre-builds the Docker images so the actual cutover is minutes, not tens.
#
# Run from the repo root on the workstation:
#   bash deploy/prod/stage-prod.sh
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

HOST=141.147.75.132
SSH="ssh -i $HOME/.ssh/esamithi_prod -o IdentitiesOnly=yes ubuntu@$HOST"
SCP="scp -q -i $HOME/.ssh/esamithi_prod -o IdentitiesOnly=yes"

echo "── Server code → /opt/esamithi-server (tar pipe; no node_modules/.env/uploads)"
$SSH 'mkdir -p /opt/esamithi-server && find /opt/esamithi-server -mindepth 1 -maxdepth 1 ! -name uploads -exec rm -rf {} +'
tar -C server -czf - \
  --exclude node_modules --exclude .env --exclude uploads --exclude tenants.json \
  . | $SSH 'tar -C /opt/esamithi-server -xzf -'
$SSH 'mkdir -p /opt/esamithi-server/uploads'

echo "── Stack files → /opt/esamithi-stack"
$SSH 'mkdir -p /opt/esamithi-stack/nginx /opt/esamithi-stack/privacy /opt/esamithi-stack/certbot-www'
$SCP deploy/prod/docker-compose.yml ubuntu@$HOST:/opt/esamithi-stack/
$SCP deploy/prod/cutover.sh deploy/prod/enable-api-tls.sh ubuntu@$HOST:/opt/esamithi-stack/
$SCP deploy/prod/nginx/esamithi.conf deploy/prod/nginx/api.conf.disabled ubuntu@$HOST:/opt/esamithi-stack/nginx/
$SCP deploy/prod/privacy/index.html ubuntu@$HOST:/opt/esamithi-stack/privacy/

echo "── Pre-building images (slow on 1-core ARM — that's why it's pre-cutover)"
$SSH 'cd /opt/esamithi-stack && sudo docker compose build api && sudo docker compose pull nginx mysql'

echo
echo "✓ Staged. Cutover when ready:"
echo "  ssh -i ~/.ssh/esamithi_prod ubuntu@$HOST"
echo "  cd /opt/esamithi-stack"
echo "  SLUG=<slug> NAME=\"<Society Name>\" INTERNAL_SECRET=<from testbed .env> bash cutover.sh"
