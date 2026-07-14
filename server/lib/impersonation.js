// Impersonation revocation check (super-admin panel §4.2): the platform keeps
// the denylist; the tenant middleware asks platform-api whether a session is
// still live, cached 60s. Platform being briefly down never blocks a logged-in
// operator — the 60-min token expiry bounds exposure either way.
const http = require('http');
const jwt = require('jsonwebtoken');

const CACHE_MS = 60 * 1000;
const cache = new Map(); // sid → { active, at }

function platformCheck(sid) {
  return new Promise((resolve) => {
    const url = new URL(`${process.env.PLATFORM_INTERNAL_URL || 'http://platform:4000'}/internal/impersonation/${sid}`);
    const token = jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '30s' });
    const req = http.get(
      url,
      { headers: { Authorization: `Bearer ${token}` }, timeout: 3000 },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try { resolve(res.statusCode === 200 && JSON.parse(body).active === true); }
          catch { resolve(null); }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// true = allowed, false = revoked/unknown. Network failure → fail-open (last
// known, else allow) so a platform blip doesn't strand support mid-task.
async function isImpersonationActive(sid) {
  const hit = cache.get(sid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.active;
  const result = await platformCheck(sid);
  if (result === null) return hit ? hit.active : true;
  cache.set(sid, { active: result, at: Date.now() });
  return result;
}

module.exports = { isImpersonationActive };
