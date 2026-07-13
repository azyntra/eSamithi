// Migration runner: applies pending migrations (see index.js) to one tenant,
// recording each in that tenant's schema_migrations table. Runs at API boot
// (fast no-op when up to date) and from the migrate.js CLI on deploys.
const MIGRATIONS = require('./index');

async function migrateTenant(pool, label = '') {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         VARCHAR(80) PRIMARY KEY,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [rows] = await pool.query('SELECT id FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.id));

  let count = 0;
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    await migration.up(pool);
    await pool.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
    console.log(`  ✓ migration ${migration.id}${label ? ` (${label})` : ''}`);
    count++;
  }
  return count;
}

module.exports = { migrateTenant };
