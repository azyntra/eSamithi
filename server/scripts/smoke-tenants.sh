#!/usr/bin/env bash
# Multi-samithi isolation smoke test ("data-isolation insurance").
# Run from anywhere with curl + python3:
#   BASE=http://212.227.103.150/api/v1 T1_USER=admin T1_PASS=... T2_USER=admin T2_PASS=... \
#     bash server/scripts/smoke-tenants.sh
set -u

BASE="${BASE:-http://212.227.103.150/api/v1}"
T1="${T1:-test01}"
T2="${T2:-demo02}"
T1_USER="${T1_USER:-admin}"; T1_PASS="${T1_PASS:?set T1_PASS (tenant 1 staff password)}"
T2_USER="${T2_USER:-admin}"; T2_PASS="${T2_PASS:?set T2_PASS (tenant 2 staff password)}"

PASS=0; FAIL=0

check() { # check <desc> <expected_status> <actual_status>
  if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  ✓ $1 → $3"
  else FAIL=$((FAIL+1)); echo "  ✗ $1 → got $3, expected $2"; fi
}

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

json_field() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))"; }

echo "── Health"
check "deep health" 200 "$(status "$BASE/health?deep=1")"

echo "── Staff login per tenant"
TOKEN1=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -H "X-Samithi: $T1" \
  -d "{\"username\":\"$T1_USER\",\"password\":\"$T1_PASS\"}" | json_field token)
[ -n "$TOKEN1" ] && { PASS=$((PASS+1)); echo "  ✓ $T1 login"; } || { FAIL=$((FAIL+1)); echo "  ✗ $T1 login failed"; }

TOKEN2=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" -H "X-Samithi: $T2" \
  -d "{\"username\":\"$T2_USER\",\"password\":\"$T2_PASS\"}" | json_field token)
[ -n "$TOKEN2" ] && { PASS=$((PASS+1)); echo "  ✓ $T2 login"; } || { FAIL=$((FAIL+1)); echo "  ✗ $T2 login failed"; }

echo "── Same-tenant access"
check "$T1 token + $T1 header" 200 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN1" -H "X-Samithi: $T1")"
check "$T2 token + $T2 header" 200 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN2" -H "X-Samithi: $T2")"

echo "── Cross-tenant isolation (the 403s that matter)"
check "$T1 token + $T2 header" 403 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN1" -H "X-Samithi: $T2")"
check "$T2 token + $T1 header" 403 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN2" -H "X-Samithi: $T1")"
check "unknown samithi header" 403 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN1" -H "X-Samithi: nope99")"

echo "── Legacy clients (no X-Samithi header → DEFAULT_TENANT)"
check "$T1 token, no header" 200 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN1")"
check "$T2 token, no header (must NOT fall into $T1)" 403 "$(status "$BASE/members" -H "Authorization: Bearer $TOKEN2")"

echo
echo "$PASS passed, $FAIL failed"
exit $((FAIL > 0 ? 1 : 0))
