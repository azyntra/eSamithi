const { getPool } = require('../db');

// Read a single setting value; `runner` may be a pool or an open connection
async function getSetting(key, runner = null) {
  const q = runner || getPool();
  const [rows] = await q.query('SELECT value FROM settings WHERE `key` = ?', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

async function isMigrationMode(runner = null) {
  const value = await getSetting('migration_completed', runner);
  return value !== 'true';
}

module.exports = { getSetting, isMigrationMode };
