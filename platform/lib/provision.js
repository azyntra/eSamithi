// Tenant provisioning for the super-admin onboard wizard (FR-3.1).
//
// The platform is the only component with cross-tenant reach, so it owns the
// privileged steps: create the database + a per-tenant MySQL user (root
// connection), register the samithi, regenerate tenants.json, then ask the
// tenant API to build the schema and seed its admin (reusing the tenant's own
// migration runner so schema stays single-sourced). No SSH, no API restart —
// the new samithi is reachable from the apps within ~1 minute.
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { syncTenantsFile } = require('./sync');

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{1,19}$/;

// mysql2/promise createConnection resolves to an already-connected connection
async function rootConn() {
  return mysql.createConnection({
    host: process.env.DB_HOST || 'mysql',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.PROVISION_DB_USER || 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
    charset: 'utf8mb4'
  });
}

function newJoinCode(slug) {
  return `${slug.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()}-${crypto.randomInt(1000, 10000)}`;
}
function secret(n = 18) {
  return crypto.randomBytes(n).toString('base64url');
}

class ProvisionError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Ask the tenant API (once tenants.json carries the new slug) to run migrations
// and seed the admin. Retries while the tenant API still resolves the slug as
// unknown (its registry cache lags the file write by up to its reload window).
async function tenantProvisionHandshake(apiUrl, slug, adminPassword) {
  const token = jwt.sign({ typ: 'internal' }, process.env.INTERNAL_SECRET || '', { expiresIn: '60s' });
  const deadline = Date.now() + 45000;
  let lastErr = 'unknown';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiUrl}/internal/provision`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Samithi': slug, 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: adminPassword })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      // 403 = tenant not yet visible to the API; keep waiting. Others: fail.
      if (res.status !== 403) throw new ProvisionError(data.error || `Schema init failed (${res.status})`, 502);
      lastErr = data.error || 'not yet visible';
    } catch (err) {
      if (err instanceof ProvisionError) throw err;
      lastErr = err.message;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new ProvisionError(`Tenant API did not pick up the new samithi in time (${lastErr}). It is registered — retry onboarding to finish schema init.`, 504);
}

// Pick the target server (single-server today; the wizard can pass server_code
// once the fleet grows). Falls back to the one active server.
async function resolveServer(serverCode) {
  const pool = getPool();
  if (serverCode) {
    const [[s]] = await pool.query('SELECT id, api_url FROM servers WHERE code = ?', [serverCode]);
    if (!s) throw new ProvisionError(`Unknown server '${serverCode}'`);
    return s;
  }
  const [[s]] = await pool.query("SELECT id, api_url FROM servers ORDER BY (role='active') DESC, id LIMIT 1");
  if (!s) throw new ProvisionError('No server registered to host the samithi', 500);
  return s;
}

async function provisionSamithi({ slug, name_en, name_si, min_app_version, server_code }) {
  slug = String(slug || '').trim().toLowerCase();
  name_en = String(name_en || '').trim();
  if (!SLUG_RE.test(slug)) throw new ProvisionError('Slug must be 2–20 chars: lowercase letters/digits, - or _, starting alphanumeric');
  if (!name_en) throw new ProvisionError('Display name (English) is required');
  if (!process.env.MYSQL_ROOT_PASSWORD) {
    throw new ProvisionError('Provisioning is not configured (MYSQL_ROOT_PASSWORD unset). Use scripts/provision-tenant.js from the server.', 501);
  }

  const pool = getPool();
  const [[existing]] = await pool.query('SELECT slug, db_name FROM samithis WHERE slug = ?', [slug]);
  const dbName = existing ? existing.db_name : `esamithi_${slug}`;
  const dbUser = `${slug.replace(/-/g, '_').slice(0, 26)}_app`;

  const root = await rootConn();
  try {
    // Never provision over a database that already holds data
    const [[{ n }]] = await root.query(
      'SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [dbName]
    );
    if (n > 0) throw new ProvisionError(`Database ${dbName} already has ${n} tables — refusing to provision over it`, 409);

    const server = await resolveServer(server_code);
    const dbPass = secret(15);
    const adminPass = secret(9);
    const joinCode = existing ? null : newJoinCode(slug);

    // 1) database + per-tenant MySQL user (idempotent; reset the password so
    //    the value we store is authoritative even on a resumed onboard)
    await root.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await root.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'%' IDENTIFIED BY ?`, [dbPass]);
    await root.query(`ALTER USER '${dbUser}'@'%' IDENTIFIED BY ?`, [dbPass]);
    await root.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'%'`);
    await root.query('FLUSH PRIVILEGES');

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

    // 3) publish to tenants.json → tenant API sees the samithi within seconds
    await syncTenantsFile();

    // 4) build schema + seed admin via the tenant's own migration runner
    const result = await tenantProvisionHandshake(server.api_url, slug, adminPass);

    const [[row]] = await pool.query(
      `SELECT s.slug, s.join_code, s.name_en, s.db_name, v.api_url
       FROM samithis s JOIN servers v ON v.id = s.server_id WHERE s.slug = ?`, [slug]
    );
    return {
      slug: row.slug,
      join_code: row.join_code,
      name_en: row.name_en,
      db_name: row.db_name,
      api_url: row.api_url,
      admin_username: 'admin',
      admin_password: adminPass,
      migrations_applied: result.migrations_applied || 0
    };
  } finally {
    await root.end().catch(() => {});
  }
}

module.exports = { provisionSamithi, ProvisionError };
