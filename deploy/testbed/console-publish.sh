#!/usr/bin/env bash
# Runs ON the control plane. Unpacks /tmp/console.tar into the console's
# document root. Uploaded and invoked by deploy/testbed/deploy-console.sh.
#
# Two constraints shape the order below.
#
# /opt/esamithi/admin is bind-mounted into nginx, so the directory itself must
# never be replaced — the mount follows the inode, and a swapped directory
# would leave nginx serving one that no longer exists.
#
# Build assets are hashed and cached forever while index.html is no-cache, so
# the safe order is: new assets first (hashed names cannot collide with the
# old ones), then index.html, then prune. At no point does a live index.html
# name a file that is not on disk.
set -euo pipefail
base=/opt/esamithi/admin
stage=/opt/esamithi/.admin-stage
stamp=$(date +%F-%H%M%S)

rm -rf "$stage"; mkdir -p "$stage"
tar -C "$stage" -xf /tmp/console.tar
[ -f "$stage/index.html" ] || { echo "no index.html in the upload"; exit 1; }

mkdir -p /opt/backups/admin
tar -C "$base" -czf "/opt/backups/admin/admin-$stamp.tar.gz" .
echo "rollback: /opt/backups/admin/admin-$stamp.tar.gz"

mkdir -p "$base/assets"
cp -a "$stage/assets/." "$base/assets/"        # 1. new assets alongside the old
cp -a "$stage/index.html" "$base/index.html"   # 2. entry point last
for f in "$base"/assets/*; do                  # 3. drop what this build lacks
  [ -e "$stage/assets/$(basename "$f")" ] || rm -f "$f"
done
rm -rf "$stage" /tmp/console.tar
echo "live: $(ls "$base"/assets | tr '\n' ' ')"
