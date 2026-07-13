const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');
const mysql = require('mysql2/promise');
const { migrateTenant } = require('./migrations/runner');

// ── Multi-samithi tenancy ────────────────────────────────────────
// One MySQL database per samithi (tenant). tenants.json maps a slug to its
// database; the tenant middleware resolves the slug per request and runs the
// handler inside `tenantContext`, so route handlers keep calling getPool()
// with no arguments. Background jobs and scripts pass the slug explicitly.
const tenantContext = new AsyncLocalStorage();

let tenants = null; // slug → { name, db, db_user?, db_password_env?, status }
const pools = new Map(); // slug → Pool

function loadTenants() {
  const file = process.env.TENANTS_FILE || path.join(__dirname, 'tenants.json');
  tenants = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return tenants;
}

function getTenants() {
  if (!tenants) loadTenants();
  return tenants;
}

function createPool(tenant) {
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    // Shared app credential unless the tenant declares its own MySQL user
    // (per-tenant users arrive with the Docker migration)
    user: tenant.db_user || process.env.DB_USER || 'esamithi_user',
    password: tenant.db_password_env
      ? process.env[tenant.db_password_env] || ''
      : process.env.DB_PASSWORD || '',
    database: tenant.db,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '5'),
    queueLimit: 0,
    charset: 'utf8mb4'
  });
}

async function initPool() {
  loadTenants();
  for (const [slug, tenant] of Object.entries(tenants)) {
    if (tenant.status !== 'active') continue;
    try {
      const pool = getPool(slug);
      const conn = await pool.getConnection();
      await conn.ping();
      conn.release();
      await migrateTenant(pool, slug);
      console.log(`✓ Tenant ready: ${slug} → ${tenant.db}`);
    } catch (err) {
      // One broken tenant must not take the whole API down: its own requests
      // fail and /health?deep=1 shows it red, everyone else keeps working.
      // Pools connect lazily, so fixing the DB needs no restart.
      console.error(`✗ Tenant FAILED: ${slug} → ${tenant.db}: ${err.message}`);
    }
  }
}

// getPool()      → pool for the request's tenant (from AsyncLocalStorage)
// getPool(slug)  → pool for an explicit tenant (jobs, scripts, health checks)
function getPool(slug) {
  const s = slug ?? tenantContext.getStore()?.slug;
  if (!s) throw new Error('No tenant context (getPool called outside a request without a slug)');
  const tenant = getTenants()[s];
  if (!tenant || tenant.status !== 'active') {
    throw Object.assign(new Error(`Unknown or inactive samithi: ${s}`), { statusCode: 403 });
  }
  let pool = pools.get(s);
  if (!pool) {
    pool = createPool(tenant);
    pools.set(s, pool);
  }
  return pool;
}

module.exports = { initPool, getPool, getTenants, tenantContext };
