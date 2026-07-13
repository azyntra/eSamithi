#!/usr/bin/env node
// Onboard a new samithi (first cut of the multi-samithi onboarding script):
//   node scripts/provision-tenant.js <slug> "<Display Name>" [--db <name>]
//
// Creates the tenant database, runs all migrations against it (000 builds the
// full base schema on an empty DB; later migrations seed puruka categories +
// default settings), and seeds an admin staff user with a one-time random
// password (printed once).
//
// Needs a MySQL account that can CREATE DATABASE: set DB_ADMIN_USER /
// DB_ADMIN_PASSWORD in the environment, else DB_USER / DB_PASSWORD are used.
//
// After running: add the tenant to tenants.json and restart the API.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const crypto = require('crypto');
const path = require('path');
const mysql = require('mysql2/promise');
const { getTenants } = require('../db');
const { migrateTenant } = require('../migrations/runner');

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

(async () => {
  const args = process.argv.slice(2);
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--db') flags[args[i].slice(2)] = args[++i];
    else positional.push(args[i]);
  }
  const [slug, name] = positional;
  if (!slug || !name) fail('Usage: node scripts/provision-tenant.js <slug> "<Display Name>" [--db <name>]');
  if (!/^[a-z0-9][a-z0-9_-]{1,19}$/.test(slug)) fail('Slug must be 2–20 chars: lowercase letters, digits, - or _');

  const tenants = getTenants();
  const registered = tenants[slug];
  if (registered) console.log(`Tenant "${slug}" already in tenants.json — creating its database`);
  const newDb = flags.db || (registered && registered.db) || `esamithi_${slug}`;

  const admin = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'esamithi_user',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
  });

  // Never provision over a database that already holds data
  const [[{ n }]] = await admin.query(
    'SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?', [newDb]
  );
  if (n > 0) fail(`Database ${newDb} already has ${n} tables — refusing to provision over it`);

  console.log(`Creating database ${newDb}`);
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${newDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  // Full schema + seed rows via the migration runner (000 builds everything
  // on an empty DB and each migration lands in schema_migrations)
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_ADMIN_USER || process.env.DB_USER || 'esamithi_user',
    password: process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '',
    database: newDb,
    charset: 'utf8mb4',
    connectionLimit: 2
  });
  await migrateTenant(pool, slug);
  console.log('✓ migrations applied');

  // Seed admin staff user (staff passwords are sha256 — see auth.routes.js)
  const password = crypto.randomBytes(9).toString('base64url');
  await pool.query(
    `INSERT INTO users (username, password, full_name, role)
     VALUES ('admin', ?, 'Administrator', 'admin')
     ON DUPLICATE KEY UPDATE username = username`,
    [crypto.createHash('sha256').update(password).digest('hex')]
  );
  console.log('✓ admin user seeded');

  await pool.end();
  await admin.end();

  console.log('\n── Next steps ──────────────────────────────────────────');
  console.log(`1. Add to ${process.env.TENANTS_FILE || path.join(__dirname, '..', 'tenants.json')}:`);
  console.log(`     "${slug}": { "name": ${JSON.stringify(name)}, "db": "${newDb}", "status": "active" }`);
  console.log('2. Restart the API (pm2 restart esamithi-api / docker compose up -d api)');
  console.log(`3. Log in as admin / ${password}  ← shown once, change it immediately`);
  console.log('4. Set up reference data (income/expense types, wallets) from the desktop app');
})().catch((err) => fail(err.message));
