#!/usr/bin/env bash
# app.esamithi.com (eSamithi Web, requirements §6.4) — issue the Let's Encrypt
# certificate and, ONLY when asked, enable the app vhost. Run ON the prod
# server from /opt/esamithi-stack after the DNS A record has propagated.
#
#   DRY_RUN=1 ./enable-app-tls.sh        # validate the challenge with the LE staging CA
#   ./enable-app-tls.sh                  # issue the certificate (Phase 0 / pre-pilot)
#   ENABLE_VHOST=1 ./enable-app-tls.sh   # Phase 4: also enable nginx/app.conf (gated preview)
#
# Unlike enable-api-tls.sh this script never touches the renewal cron: the
# existing twice-daily `certbot renew` already covers every lineage in the
# volume, and re-installing the line would clobber it.
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN=app.esamithi.com
EMAIL="${CERTBOT_EMAIL:-azyntra@gmail.com}"

echo "── DNS check"
RESOLVED=$(getent hosts "$DOMAIN" | awk '{print $1}' | head -1 || true)
MYIP=$(curl -s https://api.ipify.org || curl -s http://api.ipify.org)
if [ "$RESOLVED" != "$MYIP" ]; then
  echo "✗ $DOMAIN resolves to '$RESOLVED' but this server is '$MYIP'. Fix DNS and retry."
  exit 1
fi
echo "✓ $DOMAIN → $MYIP"

echo "── Challenge path through the running nginx"
mkdir -p certbot-www/.well-known/acme-challenge
PROBE="probe-$(date +%s)"
echo "$PROBE" | sudo tee "certbot-www/.well-known/acme-challenge/$PROBE" >/dev/null
GOT=$(curl -s "http://$DOMAIN/.well-known/acme-challenge/$PROBE" || true)
sudo rm -f "certbot-www/.well-known/acme-challenge/$PROBE"
if [ "$GOT" != "$PROBE" ]; then
  echo "✗ nginx does not serve /.well-known/acme-challenge/ for $DOMAIN (got '$GOT')."
  exit 1
fi
echo "✓ challenge path OK"

EXTRA=()
if [ "${DRY_RUN:-0}" = "1" ]; then EXTRA+=(--dry-run); echo "── DRY RUN against the staging CA"; else echo "── Issuing certificate"; fi
sudo docker run --rm \
  -v esamithi-stack_certs:/etc/letsencrypt \
  -v "$PWD/certbot-www":/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive "${EXTRA[@]}"

if [ "${DRY_RUN:-0}" = "1" ]; then echo "Dry run finished."; exit 0; fi

echo "── Certificates in the volume"
sudo docker run --rm -v esamithi-stack_certs:/etc/letsencrypt certbot/certbot certificates 2>/dev/null | grep -E "Certificate Name|Expiry"

if [ "${ENABLE_VHOST:-0}" = "1" ]; then
  if [ ! -f nginx/app.conf.disabled ]; then echo "✗ nginx/app.conf.disabled missing — deploy it first"; exit 1; fi
  echo "── Enabling the app vhost"
  cp nginx/app.conf.disabled nginx/app.conf
  sudo docker compose exec -T nginx nginx -t
  sudo docker compose up -d --force-recreate nginx
  sleep 3
  curl -s -o /dev/null -w "  https://$DOMAIN/ → %{http_code}\n" "https://$DOMAIN/"
else
  echo "Certificate ready; the vhost stays disabled until Phase 4 (ENABLE_VHOST=1)."
fi
