#!/usr/bin/env bash
# Publish the operator console (src/admin → dist-admin) to the control plane.
# Run from the repo root:
#   bash deploy/testbed/deploy-console.sh
#   SSH_KEY=~/.ssh/esamithi_ci_deploy bash deploy/testbed/deploy-console.sh
#
# The console has no CI lane (clients.yml builds it but does not ship it), so
# this is how it gets out. The publish itself runs on the server — see
# console-publish.sh for why the order there matters.
set -euo pipefail
HOST="${HOST:-root@212.227.103.150}"
SSH_KEY="${SSH_KEY:-}"
OPTS=(); [ -n "$SSH_KEY" ] && OPTS=(-i "$SSH_KEY" -o IdentitiesOnly=yes)
cd "$(dirname "$0")/../.."

echo "── Building"
npm run build:admin >/dev/null
[ -f dist-admin/index.html ] || { echo "dist-admin/index.html missing"; exit 1; }
echo "   $(find dist-admin -type f | wc -l | tr -d ' ') files"

echo "── Uploading"
tar -C dist-admin -cf /tmp/console.tar .
scp "${OPTS[@]}" -q /tmp/console.tar "$HOST:/tmp/console.tar"
scp "${OPTS[@]}" -q deploy/testbed/console-publish.sh "$HOST:/opt/esamithi/console-publish.sh"
rm -f /tmp/console.tar

echo "── Publishing → https://console.esamithi.com/admin/"
ssh "${OPTS[@]}" "$HOST" bash /opt/esamithi/console-publish.sh

echo "── Smoke"
entry=$(grep -o 'assets/[^"]*\.js' dist-admin/index.html | head -1)
for path in /admin/ "/admin/$entry"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://console.esamithi.com$path")
  printf '   %-44s %s\n' "$path" "$code"
  [ "$code" = 200 ] || { echo "   ✗ expected 200"; exit 1; }
done
echo "   ✓ console is serving this build"
