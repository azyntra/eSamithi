// Tenant provisioning for the super-admin onboard wizard (FR-3.1),
// multi-server edition. The platform is the only component with cross-tenant
// reach, but the privileged DB work happens on the TARGET server through its
// server-scoped internal API (POST /internal/server/provision-db) — so one
// control plane onboards samithis on any server in the fleet with no SSH and
// no restarts. Flow: provision DB+user on the target → register in the
// samithis table → publish registries (syncTenantsFile) → ask the target's
// tenant API to run migrations + seed the admin (its own migration runner, so
// schema stays single-sourced).
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { syncTenantsFile } = require('./sync');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,19}$/;

function newJoinCode(slug) {
  return `${slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()}-${crypto.randomInt(1000, 10000)}`;
}
function secret(n = 18) {
  return crypto.randomBytes(n).toString('base64url');
}
function internalToken() {
  return jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '60s' });
}

class ProvisionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function internalCall(apiUrl, path, body, { timeoutMs = 15000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${internalToken()}`, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  } finally {
    clearTimeout(timer);
  }
}

// Ask the target's tenant API (once its registry carries the new slug) to run
// migrations and seed the admin. Retries while the API still resolves the
// slug as unknown (registry cache lags the push by up to its reload window).
async function tenantProvisionHandshake(apiUrl, slug, adminPassword) {
  const deadline = Date.now() + 45000;
  let lastErr = 'unknown';
  while (Date.now() < deadline) {
    const r = await internalCall(apiUrl, '/internal/provision', { admin_password: adminPassword }, { headers: { 'X-Samithi': slug } });
    if (r.status >= 200 && r.status < 300) return r.data;
    // 403 = tenant not yet visible to that API; keep waiting. Others: fail.
    if (r.status !== 403 && r.status !== 0) throw new ProvisionError(r.data.error || `Schema init failed (${r.status})`, 502);
    lastErr = r.data.error || 'not yet visible';
    await new Promise((res) => setTimeout(res, 3000));
  }
  throw new ProvisionError(`Tenant API did not pick up the new samithi in time (${lastErr}). It is registered — retry onboarding to finish schema init.`, 504);
}

// Pick the target server (the wizard passes server_code; default = the one
// active server for backwards compatibility with single-server setups).
async function resolveServer(serverCode) {
  const pool = getPool();
  if (serverCode) {
    const [[s]] = await pool.query('SELECT id, code, api_url FROM servers WHERE code = ?', [serverCode]);
    if (!s) throw new ProvisionError(`Unknown server '${serverCode}'`);
    return s;
  }
  const [[s]] = await pool.query("SELECT id, code, api_url FROM servers ORDER BY (role='active') DESC, id LIMIT 1");
  if (!s) throw new ProvisionError('No server registered to host the samithi', 500);
  return s;
}

async function provisionSamithi({ slug, name_en, name_si, min_app_version, server_code }) {
  slug = String(slug || '').trim().toLowerCase();
  name_en = String(name_en || '').trim();
  if (!SLUG_RE.test(slug)) throw new ProvisionError('Slug must be 2–20 chars: lowercase letters/digits, - or _, starting alphanumeric');
  if (!name_en) throw new ProvisionError('Display name (English) is required');

  const pool = getPool();
  const [[existing]] = await pool.query('SELECT slug, db_name, server_id FROM samithis WHERE slug = ?', [slug]);
  const server = await resolveServer(server_code);
  if (existing && existing.server_id !== server.id) {
    throw new ProvisionError(`Samithi '${slug}' is already registered on another server`, 409);
  }
  const dbName = existing ? existing.db_name : `esamithi_${slug}`;
  const dbUser = `${slug.replace(/-/g, '_').slice(0, 26)}_app`;
  const dbPass = secret(15);
  const adminPass = secret(9);
  const joinCode = existing ? null : newJoinCode(slug);

  // 1) database + per-tenant MySQL user on the TARGET server
  const prov = await internalCall(server.api_url, '/internal/server/provision-db', {
    db_name: dbName, db_user: dbUser, db_password: dbPass
  });
  if (prov.status === 0) throw new ProvisionError(`Server '${server.code}' unreachable: ${prov.data.error}`, 502);
  if (prov.status >= 400) throw new ProvisionError(prov.data.error || `DB provisioning failed (${prov.status})`, prov.status === 409 ? 409 : 502);

  // 2) register (or update the resumed row) — inline db_password so the
  //    tenant API connects with no restart
  if (existing) {
    await pool.query(
      'UPDATE samithis SET name_en = ?, name_si = ?, db_user = ?, db_password = ?, min_app_version = ?, status = "active" WHERE slug = ?',
      [name_en, name_si || null, dbUser, dbPass, min_app_version || null, slug]
    );
  } else {
    await pool.query(
      `INSERT INTO samithis (slug, join_code, name_en, name_si, server_id, db_name, db_user, db_password, min_app_version, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [slug, joinCode, name_en, name_si || null, server.id, dbName, dbUser, dbPass, min_app_version || null]
    );
  }

  // 3) publish registries → the target's API sees the samithi within seconds
  await syncTenantsFile();

  // 4) build schema + seed admin via the target's own migration runner
  const result = await tenantProvisionHandshake(server.api_url, slug, adminPass);

  const [[row]] = await pool.query(
    `SELECT s.slug, s.join_code, s.name_en, s.db_name, v.api_url, v.code AS server_code
     FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.slug = ?`, [slug]
  );
  return {
    slug: row.slug,
    join_code: row.join_code,
    name_en: row.name_en,
    db_name: row.db_name,
    api_url: row.api_url,
    server_code: row.server_code,
    admin_username: 'admin',
    admin_password: adminPass,
    migrations_applied: result.migrations_applied || 0
  };
}

module.exports = { provisionSamithi, ProvisionError };
