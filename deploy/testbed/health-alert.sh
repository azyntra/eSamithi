#!/usr/bin/env bash
# Prod health watchdog → push notification to the operator's phone.
# Runs from root cron every 5 minutes on the control plane. Alerts after two
# consecutive failures of the prod deep-health check, one push per state
# change (down → up), so a flapping link can't spam the phone.
#
# Delivery rides the app's own push pipeline (Expo → FCM): the freshest
# member push token of the DEMO samithi is the operator's own phone. If the
# operator re-enrolls, the token refreshes on next app open — self-healing.
# Upgrade path: add Telegram/email in uptime-kuma and retire this.
set -u
cd /opt/esamithi
STATE_FILE=/opt/esamithi/.prod-health-state
FAILS_FILE=/opt/esamithi/.prod-health-fails
URL="https://api.esamithi.com/api/v1/health?deep=1"

code=$(curl -s -o /dev/null -m 20 -w "%{http_code}" "$URL" || echo 000)
state=$(cat "$STATE_FILE" 2>/dev/null || echo up)
fails=$(cat "$FAILS_FILE" 2>/dev/null || echo 0)

push() {
  local title="$1" body="$2"
  local token
  token=$(docker compose exec -T mysql sh -c \
    "mysql -uroot -p\$MYSQL_ROOT_PASSWORD esamithi_demo -N -e 'SELECT token FROM member_push_tokens ORDER BY updated_at DESC LIMIT 1'" 2>/dev/null | tr -d '\r')
  [ -n "$token" ] || return 0
  curl -s -m 20 -X POST https://exp.host/--/api/v2/push/send -H 'Content-Type: application/json' \
    -d "{\"to\":\"$token\",\"title\":\"$title\",\"body\":\"$body\",\"sound\":\"default\",\"priority\":\"high\"}" >/dev/null
}

if [ "$code" != "200" ]; then
  fails=$((fails + 1)); echo "$fails" > "$FAILS_FILE"
  if [ "$state" = "up" ] && [ "$fails" -ge 2 ]; then
    echo down > "$STATE_FILE"
    push "⚠️ eSamithi PROD DOWN" "api.esamithi.com deep health failing (HTTP $code) since $(date +%H:%M)"
    echo "$(date -Is) DOWN (code=$code)"
  fi
else
  echo 0 > "$FAILS_FILE"
  if [ "$state" = "down" ]; then
    echo up > "$STATE_FILE"
    push "✅ eSamithi PROD recovered" "api.esamithi.com healthy again at $(date +%H:%M)"
    echo "$(date -Is) RECOVERED"
  fi
fi
