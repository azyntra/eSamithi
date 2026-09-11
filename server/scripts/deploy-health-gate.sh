#!/usr/bin/env bash
# Deploy gate: did THIS deploy break a tenant?
#
# `curl -f` on deep health does not ask that. A registry can carry a society
# whose database was never created — the testbed has one — and deep health is
# then permanently "degraded", so a -f gate fails on every single run. That is
# worse than no gate at all, because a real regression looks exactly the same
# as the standing failure and nobody reads either.
#
# So compare the tenant map either side of the restart, and fail only when a
# tenant that was healthy before this deploy is not healthy after it:
#   before=$(bash deploy-health-gate.sh snapshot)
#   ...rebuild, migrate...
#   bash deploy-health-gate.sh compare "$before"
#
# A tenant that was already broken stays broken and stays visible in the
# output, which is where it belongs — it is a registry problem to clean up,
# not a reason to block a deploy that had nothing to do with it.
set -euo pipefail
URL="${HEALTH_URL:-http://localhost/api/v1/health?deep=1}"

snapshot() {
  curl -s --max-time 20 "$URL" | python3 -c "
import json, sys
try:
    tenants = json.load(sys.stdin).get('tenants') or {}
except Exception:
    tenants = {}
print(' '.join(sorted(k for k, v in tenants.items() if v == 'ok')))
"
}

case "${1:-compare}" in
  snapshot)
    snapshot
    ;;
  compare)
    before="${2:-}"
    after=$(snapshot)
    echo "healthy before: ${before:-(none)}"
    echo "healthy after : ${after:-(none)}"
    lost=""
    for t in $before; do
      case " $after " in *" $t "*) : ;; *) lost="$lost $t" ;; esac
    done
    if [ -n "$lost" ]; then
      echo "✗ this deploy broke:$lost"
      curl -s "$URL"; echo
      exit 1
    fi
    if [ -z "$after" ]; then
      echo "✗ no tenant is healthy — the API is not serving anyone"
      curl -s "$URL"; echo
      exit 1
    fi
    echo "✓ every tenant that was healthy still is"
    ;;
  *)
    echo "usage: deploy-health-gate.sh snapshot | compare '<tenants>'" >&2
    exit 2
    ;;
esac
