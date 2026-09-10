#!/usr/bin/env bash
# Issue the Let's Encrypt cert for api.esamithi.com and enable the HTTPS API
# vhost. Run ON the prod server from /opt/esamithi-stack, after:
#   - the Docker stack is live (cutover.sh done, nginx serving :80)
#   - DNS A record api.esamithi.com → this server has propagated
#   - port 443 is open (OCI security list + any host firewall)
set -euo pipefail
cd "$(dirname "$0")"
DOMAIN=api.esamithi.com
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
sudo docker run --rm \
  -v esamithi-stack_certs:/etc/letsencrypt \
  -v "$PWD/certbot-www":/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

echo "── Enabling the API vhost"
cp nginx/api.conf.disabled nginx/api.conf
sudo docker compose up -d --force-recreate nginx   # picks up new mounts/conf reliably

echo "── Renewal cron (twice daily; reloads nginx only when a certificate changed)"
# The old form restarted nginx on every run, renewal or not, which dropped
# every in-flight request twice a day. certbot runs the deploy hook only when
# a certificate is actually renewed, and the hook writes a flag into the
# webroot, which is a host bind mount, so the cron outside the container can
# see it and reload. A reload keeps existing connections alive.
CRON="41 2,14 * * * cd /opt/esamithi-stack && docker run --rm -v esamithi-stack_certs:/etc/letsencrypt -v /opt/esamithi-stack/certbot-www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook \"touch /var/www/certbot/.renewed\"; if [ -f /opt/esamithi-stack/certbot-www/.renewed ]; then docker exec esamithi-stack-nginx-1 nginx -s reload && rm -f /opt/esamithi-stack/certbot-www/.renewed; fi"
( sudo crontab -l 2>/dev/null | grep -v 'certbot/certbot renew' ; echo "$CRON" ) | sudo crontab -

sleep 3
echo
echo "── Verify"
curl -s -o /dev/null -w "  https://$DOMAIN/api/v1/health → %{http_code}\n" "https://$DOMAIN/api/v1/health"
curl -s -o /dev/null -w "  https://$DOMAIN/privacy/ → %{http_code}\n" "https://$DOMAIN/privacy/"
curl -s -o /dev/null -w "  http (should 301) → %{http_code}\n" "http://$DOMAIN/api/v1/health"
echo "Done. Now flip the prod server's api_url to https://$DOMAIN/api/v1 in the console registry."
