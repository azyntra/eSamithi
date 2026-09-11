#!/usr/bin/env bash
# How the office actually signs in — the number Phase 5 ends on.
#
# Every successful staff sign-in is already recorded in staff_auth_events with
# the client that made it, so this asks the database rather than parsing logs:
#   desktop  1.3.x calling POST /auth/login with its 24-hour bearer token
#   web      a browser calling POST /auth/session
#   shell    the 1.3.8 thin shell — same call, but its user agent says so
#
# Run on a server host from the compose directory (/opt/esamithi):
#   bash adoption.sh [days]          # default 14
#
# Read-only: one SELECT per tenant database and nothing else. A sign-in is not
# quite a session — a desktop token lasts a day, a web session up to a day —
# but both are "someone started work", which is what the question is about.
set -u
DAYS="${1:-14}"
case "$DAYS" in ''|*[!0-9]*) echo "usage: adoption.sh [days]" >&2; exit 2;; esac

sql() { docker compose exec -T mysql sh -c "mysql -uroot -p\$MYSQL_ROOT_PASSWORD -N -B -e \"$1\"" 2>/dev/null | tr -d '\r'; }

# Any database carrying the auth-event table is a tenant that has migration 015
DBS=$(sql "SELECT TABLE_SCHEMA FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='staff_auth_events' ORDER BY TABLE_SCHEMA")
if [ -z "$DBS" ]; then
  echo "No tenant database has staff_auth_events yet — migration 015 has not run here."
  exit 1
fi

echo "Staff sign-ins over the last $DAYS days"
echo

T_DESKTOP=0; T_WEB=0; T_SHELL=0
for db in $DBS; do
  rows=$(sql "SELECT client, COUNT(*), COUNT(DISTINCT user_id), DATE_FORMAT(MAX(created_at), '%Y-%m-%d %H:%i') \
              FROM \\\`$db\\\`.staff_auth_events \
              WHERE event='login_ok' AND created_at >= DATE_SUB(NOW(), INTERVAL $DAYS DAY) \
              GROUP BY client ORDER BY client")
  # The database name carries the slug, which is what the console calls it
  name=${db#esamithi_}
  [ -n "$rows" ] || { printf '%s\n  no sign-ins\n\n' "$name"; continue; }

  echo "$name"
  d=0; w=0; s=0
  while IFS=$'\t' read -r client n staff last; do
    [ -n "${client:-}" ] || continue
    printf '  %-9s %5s sign-ins  %3s staff   last %s\n' "$client" "$n" "$staff" "$last"
    case "$client" in desktop) d=$n;; web) w=$n;; shell) s=$n;; esac
  done <<< "$rows"

  total=$((d + w + s))
  if [ "$total" -gt 0 ]; then
    printf '  on web or shell: %s%%\n' "$(( (w + s) * 100 / total ))"
  fi
  echo
  T_DESKTOP=$((T_DESKTOP + d)); T_WEB=$((T_WEB + w)); T_SHELL=$((T_SHELL + s))
done

TOTAL=$((T_DESKTOP + T_WEB + T_SHELL))
if [ "$TOTAL" -eq 0 ]; then
  echo "No staff sign-ins recorded in this window."
  exit 0
fi
MOVED=$(( (T_WEB + T_SHELL) * 100 / TOTAL ))
echo "Fleet: $TOTAL sign-ins — desktop $T_DESKTOP, web $T_WEB, shell $T_SHELL"
echo "On web or shell: ${MOVED}%   (Phase 5 ends at 90%)"
