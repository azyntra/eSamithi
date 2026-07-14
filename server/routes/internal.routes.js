const express = require('express');
const { getPool } = require('../db');
const { internalAuth } = require('../middleware/internal');

// Platform stats pull (super-admin panel §4.3). Tenant is resolved by the
// normal X-Samithi middleware; internalAuth gates it to platform-api.
const router = express.Router();
router.use(internalAuth);

// GET /api/v1/internal/stats — one counters snapshot for this tenant
router.get('/stats', async (_req, res, next) => {
  try {
    const pool = getPool();
    const q = async (sql) => { const [[row]] = await pool.query(sql); return row; };

    const members = await q(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END) AS enrolled
      FROM members`);
    const staff = await q('SELECT COUNT(*) AS n FROM users');
    const wallets = await q("SELECT IFNULL(SUM(balance),0) AS cents FROM wallets WHERE is_active = 1");
    const loans = await q(`SELECT COUNT(*) AS n, IFNULL(SUM(principal_owed + interest_owed + fines_owed),0) AS cents
      FROM loans WHERE status IN ('Active','Overdue')`);
    const fds = await q("SELECT COUNT(*) AS n, IFNULL(SUM(principal),0) AS cents FROM fixed_deposits WHERE status = 'Active'");
    const pending = await q("SELECT COUNT(*) AS n FROM member_requests WHERE status = 'Pending'");
    const lastTxn = await q(`SELECT GREATEST(
        IFNULL((SELECT MAX(date) FROM income_ledger), '1970-01-01'),
        IFNULL((SELECT MAX(date) FROM expense_ledger), '1970-01-01')
      ) AS d`);
    const migration = await q('SELECT IFNULL(MAX(id), "none") AS v FROM schema_migrations');

    res.json({
      members_total: Number(members.total),
      members_active: Number(members.active),
      members_enrolled: Number(members.enrolled),
      staff_users: Number(staff.n),
      wallets_total_cents: Number(wallets.cents),
      loans_active: Number(loans.n),
      loans_outstanding_cents: Number(loans.cents),
      fds_count: Number(fds.n),
      fds_value_cents: Number(fds.cents),
      pending_requests: Number(pending.n),
      last_txn_at: lastTxn.d && String(lastTxn.d).startsWith('1970') ? null : lastTxn.d,
      migration_version: migration.v
    });
  } catch (err) { next(err); }
});

module.exports = router;
