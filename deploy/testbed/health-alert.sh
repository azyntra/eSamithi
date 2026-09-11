#!/usr/bin/env bash
# Prod health watchdog → push notification to the operator's phone.
# Runs from root cron every 5 minutes on the control plane. Alerts after two
# consecutive failures of a check, one push per state change (down → up), so a
# flapping link can't spam the phone.
#
# Two things are watched, each with its own state, so an outage of one cannot
# mask the other recovering:
#   api — the tenant API the desktop and the mobile app depend on
#   app — the office web application at app.esamithi.com
#
# Delivery rides the app's own push pipeline (Expo → FCM): the freshest
# member push token of the DEMO samithi is the operator's own phone. If the
# operator re-enrolls, the token refreshes on next app open — self-healing.
# Upgrade path: add Telegram/email in uptime-kuma and retire this.
set -u
cd /opt/esamithi

push() {
  local title="$1" body="$2"
  local token
  token=$(docker compose exec -T mysql sh -c \
    "mysql -uroot -p\$MYSQL_ROOT_PASSWORD esamithi_demo -N -e 'SELECT token FROM member_push_tokens ORDER BY updated_at DESC LIMIT 1'" 2>/dev/null | tr -d '\r')
  [ -n "$token" ] || return 0
  curl -s -m 20 -X POST https://exp.host/--/api/v2/push/send -H 'Content-Type: application/json' \
    -d "{\"to\":\"$token\",\"title\":\"$title\",\"body\":\"$body\",\"sound\":\"default\",\"priority\":\"high\"}" >/dev/null
}

# key|url|label|text the body must contain
# The body matters: the web app answers 200 for any unknown path because a
# single-page app falls back to its shell, and the API can answer 200 while
# reporting a degraded tenant. A status code alone would miss both.
CHECKS="
api|https://api.esamithi.com/api/v1/health?deep=1|api.esamithi.com deep health|\"status\":\"ok\"
app|https://app.esamithi.com/|app.esamithi.com (the office web app)|id=\"root\"
"

# The API keeps the original state files so an in-flight outage is not
# forgotten the first time this version runs.
state_file() { [ "$1" = api ] && echo /opt/esamithi/.prod-health-state || echo "/opt/esamithi/.prod-health-state-$1"; }
fails_file() { [ "$1" = api ] && echo /opt/esamithi/.prod-health-fails || echo "/opt/esamithi/.prod-health-fails-$1"; }

echo "$CHECKS" | while IFS='|' read -r key url label needle; do
  [ -n "${key:-}" ] || continue
  sf=$(state_file "$key")
  ff=$(fails_file "$key")

  body=$(curl -s -m 20 -w '\n%{http_code}' "$url" || echo "000")
  code=$(printf '%s' "$body" | tail -1)
  if printf '%s' "$body" | grep -qF "$needle"; then
    reason="HTTP $code"
  else
    # Reached something, but not the thing we are watching for.
    reason="HTTP $code and the wrong response"
    code=wrong-body
  fi
  state=$(cat "$sf" 2>/dev/null || echo up)
  fails=$(cat "$ff" 2>/dev/null || echo 0)

  if [ "$code" != "200" ]; then
    fails=$((fails + 1)); echo "$fails" > "$ff"
    if [ "$state" = "up" ] && [ "$fails" -ge 2 ]; then
      echo down > "$sf"
      push "⚠️ eSamithi PROD DOWN" "$label failing ($reason) since $(date +%H:%M)"
      echo "$(date -Is) DOWN $key ($reason)"
    fi
  else
    echo 0 > "$ff"
    if [ "$state" = "down" ]; then
      echo up > "$sf"
      push "✅ eSamithi PROD recovered" "$label healthy again at $(date +%H:%M)"
      echo "$(date -Is) RECOVERED $key"
    fi
  fi
done
