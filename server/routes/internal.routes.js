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

// GET /api/v1/internal/detail — richer per-samithi drill-down for the panel
// (super-admin FR-4). Read-only; one round trip.
router.get('/detail', async (_req, res, next) => {
  try {
    const pool = getPool();

    const [[members]] = await pool.query(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 OR is_active IS NULL THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN pin_hash IS NOT NULL THEN 1 ELSE 0 END) AS enrolled,
      SUM(CASE WHEN pin_locked_until IS NOT NULL AND pin_locked_until > NOW() THEN 1 ELSE 0 END) AS locked_pins,
      SUM(CASE WHEN app_enabled = 0 THEN 1 ELSE 0 END) AS app_disabled
      FROM members`);
    const [[push]] = await pool.query('SELECT COUNT(*) AS n FROM member_push_tokens');
    const [[loans]] = await pool.query(`SELECT
      COUNT(*) AS active,
      SUM(CASE WHEN status = 'Overdue' THEN 1 ELSE 0 END) AS overdue,
      IFNULL(SUM(principal_owed + interest_owed + fines_owed),0) AS outstanding
      FROM loans WHERE status IN ('Active','Overdue')`);
    const [[fds]] = await pool.query("SELECT COUNT(*) AS n, IFNULL(SUM(principal),0) AS cents FROM fixed_deposits WHERE status = 'Active'");
    const [[pending]] = await pool.query("SELECT COUNT(*) AS n FROM member_requests WHERE status = 'Pending'");
    const [wallets] = await pool.query('SELECT id, name, balance, is_active FROM wallets ORDER BY is_active DESC, name');
    const [staff] = await pool.query('SELECT id, username, full_name, role FROM users ORDER BY role, username');
    const [settings] = await pool.query('SELECT `key`, `value` FROM settings ORDER BY `key`');
    const [migrations] = await pool.query('SELECT id, applied_at FROM schema_migrations ORDER BY id');

    res.json({
      members: {
        total: Number(members.total), active: Number(members.active), inactive: Number(members.inactive),
        enrolled: Number(members.enrolled), locked_pins: Number(members.locked_pins),
        app_disabled: Number(members.app_disabled), push_tokens: Number(push.n)
      },
      loans: { active: Number(loans.active), overdue: Number(loans.overdue), outstanding_cents: Number(loans.outstanding) },
      fds: { count: Number(fds.n), value_cents: Number(fds.cents) },
      pending_requests: Number(pending.n),
      wallets: wallets.map((w) => ({ id: w.id, name: w.name, balance_cents: Number(w.balance), is_active: Number(w.is_active) })),
      staff: staff.map((u) => ({ id: u.id, username: u.username, full_name: u.full_name, role: u.role })),
      settings: settings.map((s) => ({ key: s.key, value: s.value })),
      migrations: migrations.map((m) => ({ id: m.id, applied_at: m.applied_at }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
