#!/usr/bin/env bash
# Issue the Let's Encrypt certificate for testbed.esamithi.com and enable the
# HTTPS vhost. Run ON the server (from /opt/esamithi) AFTER the DNS A record
#   testbed.esamithi.com → 212.227.103.150
# has propagated. Port 80 keeps serving plain HTTP for old clients.
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN=testbed.esamithi.com
EMAIL="${CERTBOT_EMAIL:-azyntra@gmail.com}"

echo "── DNS check"
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
MYIP=$(curl -s https://api.ipify.org)
if [ "$RESOLVED" != "$MYIP" ]; then
  echo "✗ $DOMAIN resolves to '$RESOLVED' but this server is $MYIP."
  echo "  Add the A record at your DNS provider and wait for propagation."
  exit 1
fi
echo "✓ $DOMAIN → $MYIP"

echo "── Issuing certificate (webroot via the running nginx)"
mkdir -p certbot-www
docker run --rm \
  -v esamithi_certs:/etc/letsencrypt \
  -v "$PWD/certbot-www":/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "── Enabling the HTTPS vhost"
cp nginx/esamithi-ssl.conf.disabled nginx/esamithi-ssl.conf
docker compose up -d nginx
docker compose restart nginx

echo "── Renewal cron (twice daily, standard certbot cadence)"
CRON="17 3,15 * * * cd /opt/esamithi && docker run --rm -v esamithi_certs:/etc/letsencrypt -v /opt/esamithi/certbot-www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose restart nginx"
( crontab -l 2>/dev/null | grep -v 'certbot/certbot renew' ; echo "$CRON" ) | crontab -

echo
curl -s "https://$DOMAIN/api/v1/health" && echo
echo "Done. Next steps:"
echo "  1. Flip api_url in directory.json to https://$DOMAIN/api/v1 (resolved clients follow automatically)"
echo "  2. Once all clients are on HTTPS builds: drop usesCleartextTraffic / ATS exceptions"
