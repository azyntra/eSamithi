#!/usr/bin/env bash
# Issue the Let's Encrypt cert for console.esamithi.com and enable the HTTPS
# operator console. Run ON the server from /opt/esamithi, after the DNS A
# record console.esamithi.com → this server has propagated.
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN=console.esamithi.com
EMAIL="${CERTBOT_EMAIL:-azyntra@gmail.com}"

echo "── DNS check"
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
MYIP=$(curl -s https://api.ipify.org || curl -s http://api.ipify.org)
if [ "$RESOLVED" != "$MYIP" ]; then
  echo "✗ $DOMAIN resolves to '$RESOLVED' but this server is '$MYIP'. Fix DNS and retry."
  exit 1
fi
echo "✓ $DOMAIN → $MYIP"

echo "── Issuing certificate (webroot via the running nginx on :80)"
mkdir -p certbot-www
docker run --rm \
  -v esamithi_certs:/etc/letsencrypt \
  -v "$PWD/certbot-www":/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "── Enabling the console vhost"
cp nginx/console.conf.disabled nginx/console.conf
docker compose up -d --force-recreate nginx   # picks up new mounts/conf reliably

echo "── Renewal cron (twice daily; reloads nginx after renew)"
CRON="23 3,15 * * * cd /opt/esamithi && docker run --rm -v esamithi_certs:/etc/letsencrypt -v /opt/esamithi/certbot-www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose restart nginx"
( crontab -l 2>/dev/null | grep -v 'certbot/certbot renew' ; echo "$CRON" ) | crontab -

sleep 3
echo
echo "── Verify"
curl -s -o /dev/null -w "  https://$DOMAIN/admin/ → %{http_code}\n" "https://$DOMAIN/admin/"
curl -s -o /dev/null -w "  http (should 301) → %{http_code}\n" "http://$DOMAIN/admin/"
echo "Done. Open https://$DOMAIN"
