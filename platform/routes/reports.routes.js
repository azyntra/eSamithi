const express = require('express');
const { getPool } = require('../db');

// Cross-samithi reporting (super-admin FR-6). Reads the cached per-tenant
// snapshots (collector, hourly) so reports load fast without fanning out live.
// CSV export is done client-side from this JSON.
const router = express.Router();

// GET /pa/v1/reports/comparison — one row per samithi + fleet totals
router.get('/comparison', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT s.slug, s.name_en, s.status, s.join_code,
             c.captured_at, c.reachable,
             IFNULL(c.members_total,0)           AS members_total,
             IFNULL(c.members_active,0)          AS members_active,
             IFNULL(c.members_enrolled,0)        AS members_enrolled,
             IFNULL(c.staff_users,0)             AS staff_users,
             IFNULL(c.wallets_total_cents,0)     AS wallets_total_cents,
             IFNULL(c.loans_active,0)            AS loans_active,
             IFNULL(c.loans_outstanding_cents,0) AS loans_outstanding_cents,
             IFNULL(c.fds_count,0)               AS fds_count,
             IFNULL(c.fds_value_cents,0)         AS fds_value_cents,
             IFNULL(c.pending_requests,0)        AS pending_requests,
             c.last_txn_at
      FROM samithis s LEFT JOIN tenant_stats_current c ON c.samithi_slug = s.slug
      WHERE s.status != 'archived'
      ORDER BY s.name_en`);

    const totals = rows.reduce((a, r) => ({
      members_total: a.members_total + Number(r.members_total),
      members_active: a.members_active + Number(r.members_active),
      members_enrolled: a.members_enrolled + Number(r.members_enrolled),
      staff_users: a.staff_users + Number(r.staff_users),
      wallets_total_cents: a.wallets_total_cents + Number(r.wallets_total_cents),
      loans_active: a.loans_active + Number(r.loans_active),
      loans_outstanding_cents: a.loans_outstanding_cents + Number(r.loans_outstanding_cents),
      fds_count: a.fds_count + Number(r.fds_count),
      fds_value_cents: a.fds_value_cents + Number(r.fds_value_cents),
      pending_requests: a.pending_requests + Number(r.pending_requests)
    }), {
      members_total: 0, members_active: 0, members_enrolled: 0, staff_users: 0,
      wallets_total_cents: 0, loans_active: 0, loans_outstanding_cents: 0,
      fds_count: 0, fds_value_cents: 0, pending_requests: 0
    });

    const [[{ captured_at }]] = await getPool().query('SELECT MAX(captured_at) AS captured_at FROM tenant_stats_current');
    res.json({ rows, totals, as_of: captured_at });
  } catch (err) { next(err); }
});

// GET /pa/v1/reports/inactivity?days=N — samithis with no transaction in N days
router.get('/inactivity', async (req, res, next) => {
  try {
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));
    const [rows] = await getPool().query(`
      SELECT s.slug, s.name_en, s.status, c.last_txn_at, c.reachable, c.captured_at,
             IFNULL(c.members_total,0) AS members_total,
             DATEDIFF(CURDATE(), c.last_txn_at) AS days_since
      FROM samithis s LEFT JOIN tenant_stats_current c ON c.samithi_slug = s.slug
      WHERE s.status = 'active'
        AND (c.last_txn_at IS NULL OR c.last_txn_at < DATE_SUB(CURDATE(), INTERVAL ? DAY))
      ORDER BY c.last_txn_at IS NULL DESC, c.last_txn_at ASC`, [days]);
    res.json({ days, rows });
  } catch (err) { next(err); }
});

module.exports = router;
