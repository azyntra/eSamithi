const fs = require('fs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const TENANTS_FILE = process.env.TENANTS_FILE || '/etc/esamithi/tenants.json';
// Which servers-table row is THIS host (the one whose tenants.json we can
// write directly). Remote servers get their registry pushed over their API.
const LOCAL_SERVER_CODE = process.env.LOCAL_SERVER_CODE || 'server1';

function internalToken() {
  return jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '60s' });
}

function tenantEntry(r) {
  return {
    name: r.name_en,
    db: r.db_name,
    status: r.status,
    ...(r.db_user ? { db_user: r.db_user } : {}),
    ...(r.db_password ? { db_password: r.db_password } : {}),
    ...(r.db_password_env ? { db_password_env: r.db_password_env } : {})
  };
}

async function pushRegistry(apiUrl, tenants) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${apiUrl}/internal/server/registry`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${internalToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenants }),
      signal: ctrl.signal
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

// The samithis table is the source of truth; each server's tenants.json is a
// generated artifact its tenant API consumes (re-read within 30 s). The local
// server's file is written directly (works even if its API is down); remote
// servers receive theirs through the API's server-scoped internal endpoint.
// A remote push failure logs and continues — an unreachable API wasn't going
// to act on the update anyway, and the next sync retries.
async function syncTenantsFile() {
  const [rows] = await getPool().query(`
    SELECT s.slug, s.name_en, s.db_name, s.db_user, s.db_password_env, s.db_password, s.status,
           v.code AS server_code, v.api_url
    FROM samithis s JOIN servers v ON v.id = s.server_id
    WHERE s.status != 'archived'`);

  const byServer = new Map(); // code → { api_url, tenants }
  for (const r of rows) {
    if (!byServer.has(r.server_code)) byServer.set(r.server_code, { api_url: r.api_url, tenants: {} });
    byServer.get(r.server_code).tenants[r.slug] = tenantEntry(r);
  }
  // Servers with zero samithis still need their (empty) registry maintained
  const [servers] = await getPool().query('SELECT code, api_url FROM servers');
  for (const v of servers) {
    if (!byServer.has(v.code)) byServer.set(v.code, { api_url: v.api_url, tenants: {} });
  }

  const failures = [];
  for (const [code, { api_url, tenants }] of byServer) {
    if (code === LOCAL_SERVER_CODE) {
      // In-place write on purpose: bind-mounted file, the inode must survive
      fs.writeFileSync(TENANTS_FILE, JSON.stringify(tenants, null, 2) + '\n');
    } else {
      try {
        await pushRegistry(api_url, tenants);
      } catch (err) {
        failures.push(`${code}: ${err.message}`);
        console.error(`[sync] registry push to ${code} failed:`, err.message);
      }
    }
  }
  return { failures };
}

module.exports = { syncTenantsFile };
