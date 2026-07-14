const { getPool } = require('../db');

// Impersonated writes are recorded in the tenant's own DB so its staff can see
// that platform support made a change (FR-5.4). Table is created lazily.
let ensured = new Set();

async function ensureTable(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS support_actions (
    id         INT PRIMARY KEY AUTO_INCREMENT,
    actor      VARCHAR(40)  NOT NULL,
    sid        VARCHAR(40)  DEFAULT NULL,
    method     VARCHAR(10)  NOT NULL,
    path       VARCHAR(255) NOT NULL,
    status     INT          DEFAULT NULL,
    created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    KEY idx_support_sid (sid)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function logSupportAction(tenant, entry) {
  const pool = getPool(tenant);
  if (!ensured.has(tenant)) { await ensureTable(pool); ensured.add(tenant); }
  await pool.query(
    'INSERT INTO support_actions (actor, sid, method, path, status) VALUES (?, ?, ?, ?, ?)',
    [entry.actor, entry.sid || null, entry.method, entry.path.slice(0, 255), entry.status]
  );
}

module.exports = { logSupportAction };
