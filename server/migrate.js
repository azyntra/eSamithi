#!/usr/bin/env node
// Applies pending migrations (migrations/index.js) to every active tenant,
// recording them in each tenant's schema_migrations table.
// Usage: node migrate.js            — all active tenants
//        node migrate.js <slug>     — one tenant
require('dotenv').config();
const { getTenants, getPool } = require('./db');
const { migrateTenant } = require('./migrations/runner');

(async () => {
  const only = process.argv[2];
  let failed = false;
  for (const [slug, tenant] of Object.entries(getTenants())) {
    if (only && slug !== only) continue;
    if (tenant.status !== 'active') {
      console.log(`- ${slug} skipped (${tenant.status})`);
      continue;
    }
    try {
      const applied = await migrateTenant(getPool(slug), slug);
      console.log(`✓ ${slug} (${tenant.db}) up to date${applied ? ` — ${applied} applied` : ''}`);
    } catch (err) {
      failed = true;
      console.error(`✗ ${slug} (${tenant.db}): ${err.message}`);
    }
  }
  process.exit(failed ? 1 : 0);
})();
