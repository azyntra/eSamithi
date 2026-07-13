#!/usr/bin/env bash
# Push the Docker stack files to the testbed. Run from the repo root:
#   bash deploy/testbed/deploy-testbed-inc2.sh
# Then, ON the server:  cd /opt/esamithi && bash migrate-to-docker.sh
set -euo pipefail

HOST="${HOST:-root@212.227.103.150}"
cd "$(dirname "$0")/../.."   # repo root

echo "── Copying stack files → /opt/esamithi and Dockerfile → /opt/server"
tar -C deploy/testbed -cf - docker-compose.yml nginx migrate-to-docker.sh \
  | ssh "$HOST" "mkdir -p /opt/esamithi && tar -C /opt/esamithi -xf - && \
                 chmod +x /opt/esamithi/migrate-to-docker.sh"
tar -C server -cf - Dockerfile .dockerignore | ssh "$HOST" "tar -C /opt/server -xf -"

echo
echo "Files pushed. Now run the cutover ON the server (watch it live):"
echo "  ssh $HOST"
echo "  cd /opt/esamithi && bash migrate-to-docker.sh"
