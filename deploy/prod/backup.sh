#!/usr/bin/env bash
# PROD nightly backups: per-tenant MySQL dumps + uploads archive, kept 7 days
# locally and pushed off-site to the control-plane server (kept 21 days).
# Installed at /opt/esamithi-stack/backup.sh, run by root cron at 02:10.
# Off-site auth: root ed25519 key (/root/.ssh/id_ed25519) authorized on the
# control plane — created by the deploy step that installed this script.
set -euo pipefail
cd /opt/esamithi-stack

OFFSITE="root@212.227.103.150"
OFFSITE_DIR="/opt/backups/prod-offsite"
STAMP=$(date +%F)
DEST="/opt/backups/$STAMP"
mkdir -p "$DEST"
ROOT_PW=$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)

# One dump per tenant database (single-samithi restore, same as testbed)
for db in $(python3 -c "import json; print(' '.join(v['db'] for v in json.load(open('/opt/esamithi-stack/tenants.json')).values()))"); do
  # --set-gtid-purged=OFF: a single-tenant dump must restore cleanly into a
  # live server without dragging the source's GTID state along
  docker compose exec -T mysql mysqldump -uroot -p"$ROOT_PW" \
    --single-transaction --no-tablespaces --set-gtid-purged=OFF "$db" | gzip > "$DEST/$db.sql.gz"
  gunzip -t "$DEST/$db.sql.gz"   # a backup that can't decompress is not a backup
  echo "  dumped $db ($(du -h "$DEST/$db.sql.gz" | cut -f1))"
done

# Member photos and other uploads
tar -czf "$DEST/uploads.tar.gz" -C /opt/esamithi-server uploads

# Local retention: 7 daily sets (the off-site copy holds 21)
find /opt/backups -maxdepth 1 -mindepth 1 -type d -mtime +7 -exec rm -rf {} +

# Off-site: copy tonight's set to the control plane, then prune old sets there
ssh -o BatchMode=yes -o ConnectTimeout=20 "$OFFSITE" "mkdir -p '$OFFSITE_DIR/$STAMP'"
scp -o BatchMode=yes -q "$DEST"/* "$OFFSITE:$OFFSITE_DIR/$STAMP/"
ssh -o BatchMode=yes "$OFFSITE" "find '$OFFSITE_DIR' -maxdepth 1 -mindepth 1 -type d -mtime +21 -exec rm -rf {} +"

echo "$(date -Is) backup ok → $DEST (+ off-site $OFFSITE_DIR/$STAMP)"
