#!/usr/bin/env bash
# Publish web/dist to https://app.esamithi.com.
#
# Atomic and reversible: each build lands in its own release directory and a
# relative symlink is flipped over it, so a rollback is one symlink away and a
# half-uploaded release is never served. Nothing here touches the api or mysql
# containers, and nginx is reloaded (not restarted), so the live client's API
# is never interrupted.
#
#   bash deploy/prod/deploy-web.sh              # build, upload, flip, smoke
#   ENABLE_VHOST=1 bash deploy/prod/deploy-web.sh   # also install app.conf
#   ROLLBACK=<sha> bash deploy/prod/deploy-web.sh   # flip back to a release
#   DRY_RUN=1 bash deploy/prod/deploy-web.sh    # print what it would do
set -euo pipefail

HOST="${HOST:-ubuntu@141.147.75.132}"
KEY="${KEY:-$HOME/.ssh/esamithi_prod}"
BASE="${BASE:-/opt/esamithi-stack/certbot-www/app}"   # already mounted into nginx
CONF_DIR="${CONF_DIR:-/opt/esamithi-stack/nginx}"
URL="${URL:-https://app.esamithi.com}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SHA="${SHA:-$(git -C "$REPO_ROOT" rev-parse HEAD)}"
SSH=(ssh -i "$KEY" -o BatchMode=yes -o ConnectTimeout=20 "$HOST")

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
run() { if [ "${DRY_RUN:-0}" = "1" ]; then echo "DRY: ${*}"; else "$@"; fi; }

if [ -n "${ROLLBACK:-}" ]; then
  say "Rolling back to $ROLLBACK"
  run "${SSH[@]}" "set -e
    test -d '$BASE/releases/$ROLLBACK' || { echo 'no such release'; exit 1; }
    sudo ln -sfn 'releases/$ROLLBACK' '$BASE/current.tmp' && sudo mv -Tf '$BASE/current.tmp' '$BASE/current'
    readlink '$BASE/current'"
  curl -fsS -o /dev/null -w 'shell %{http_code}\n' "$URL/" || true
  exit 0
fi

say "Building web/dist (base /, production API on the same origin)"
run bash -c "cd '$REPO_ROOT/web' && npm run build && npm run check:bundle"

say "Uploading release $SHA"
if [ "${DRY_RUN:-0}" = "1" ]; then
  echo "DRY: tar web/dist | ssh $HOST 'extract into $BASE/releases/$SHA'"
else
  tar -C "$REPO_ROOT/web/dist" -cf - . | "${SSH[@]}" "set -e
    sudo mkdir -p '$BASE/releases/$SHA'
    sudo tar -C '$BASE/releases/$SHA' -xf -
    sudo chown -R root:root '$BASE/releases/$SHA'
    sudo chmod -R a+rX '$BASE'"
fi

say "Adding this release's assets to the pool (older releases keep working)"
run "${SSH[@]}" "set -e
  sudo mkdir -p '$BASE/pool/assets'
  sudo cp -an '$BASE/releases/$SHA/assets/.' '$BASE/pool/assets/' 2>/dev/null || true
  sudo chmod -R a+rX '$BASE/pool'
  # A chunk nobody has asked for in 30 days belongs to a release nobody is on
  sudo find '$BASE/pool/assets' -type f -mtime +30 -delete
  sudo sh -c \"ls '$BASE/pool/assets' | wc -l | xargs echo 'assets in pool:'\""

say "Flipping the symlink"
run "${SSH[@]}" "set -e
  sudo ln -sfn 'releases/$SHA' '$BASE/current.tmp'
  sudo mv -Tf '$BASE/current.tmp' '$BASE/current'
  readlink '$BASE/current'
  # keep the three most recent releases
  sudo sh -c \"ls -dt '$BASE'/releases/* | tail -n +4 | xargs -r rm -rf\""

if [ "${ENABLE_VHOST:-0}" = "1" ]; then
  say "Installing app.conf (nginx reload, no restart)"
  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "DRY: copy app-headers.inc + app.conf.disabled -> $CONF_DIR, nginx -t, reload"
  else
    scp -i "$KEY" -o BatchMode=yes \
      "$REPO_ROOT/deploy/prod/nginx/app-headers.inc" \
      "$REPO_ROOT/deploy/prod/nginx/app.conf.disabled" "$HOST:/tmp/"
    "${SSH[@]}" "set -e
      sudo cp /tmp/app-headers.inc '$CONF_DIR/app-headers.inc'
      sudo cp /tmp/app.conf.disabled '$CONF_DIR/app.conf'
      rm -f /tmp/app-headers.inc /tmp/app.conf.disabled
      sudo docker exec esamithi-stack-nginx-1 nginx -t
      sudo docker exec esamithi-stack-nginx-1 nginx -s reload
      echo 'nginx reloaded'"
  fi
fi

say "Smoke"
if [ "${DRY_RUN:-0}" = "1" ]; then echo "DRY: curl $URL"; exit 0; fi
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL/" || true)
echo "GET $URL/            -> $code"
echo "GET $URL/api/v1/health -> $(curl -s -o /dev/null -w '%{http_code}' "$URL/api/v1/health" || true)"
echo "GET https://api.esamithi.com/api/v1/health -> $(curl -s -o /dev/null -w '%{http_code}' https://api.esamithi.com/api/v1/health || true)   (must stay 200)"
