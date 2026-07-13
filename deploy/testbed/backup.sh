#!/usr/bin/env bash
# Nightly per-tenant MySQL dumps + uploads archive (multi-samithi plan §3.3).
# Installed at /opt/esamithi/backup.sh, run by root cron at 01:30.
# Retention: 14 daily sets. Offsite restic push: wire in once object storage
# credentials exist (see TODO at the bottom).
set -euo pipefail
cd /opt/esamithi

STAMP=$(date +%F)
DEST="/opt/backups/$STAMP"
mkdir -p "$DEST"
ROOT_PW=$(grep '^MYSQL_ROOT_PASSWORD=' .env | cut -d= -f2-)

# One dump per tenant database (single samithi restore, per the plan)
for db in $(node -e "const t=require('/opt/esamithi/tenants.json');console.log(Object.values(t).map(x=>x.db).join(' '))"); do
  # --set-gtid-purged=OFF: a single-tenant dump must restore cleanly into a
  # live server without dragging the source's GTID state along
  docker compose exec -T mysql mysqldump -uroot -p"$ROOT_PW" \
    --single-transaction --no-tablespaces --set-gtid-purged=OFF "$db" | gzip > "$DEST/$db.sql.gz"
  gunzip -t "$DEST/$db.sql.gz"   # a backup that can't decompress is not a backup
  echo "  dumped $db ($(du -h "$DEST/$db.sql.gz" | cut -f1))"
done

# Member photos and other uploads
tar -czf "$DEST/uploads.tar.gz" -C /opt/server uploads

# Retention: 14 daily sets
find /opt/backups -maxdepth 1 -mindepth 1 -type d -mtime +14 -exec rm -rf {} +

echo "$(date -Is) backup ok → $DEST"

# TODO offsite (needs bucket credentials): restic -r s3:... backup /opt/backups/$STAMP
