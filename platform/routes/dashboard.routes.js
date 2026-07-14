const express = require('express');
const { getPool } = require('../db');
const { collectAll } = require('../lib/collector');

// Platform dashboard (FR-2): headline counters + fleet financial aggregates
// from the cached snapshots, plus the samithis-at-a-glance table.
const router = express.Router();

router.get('/', async (_req, res, next) => {
  try {
    const pool = getPool();
    const [[reg]] = await pool.query(`SELECT
      COUNT(*) AS total,
      SUM(status = 'active') AS active,
      SUM(status = 'suspended') AS suspended FROM samithis`);
    const [[agg]] = await pool.query(`SELECT
      IFNULL(SUM(members_total),0) AS members,
      IFNULL(SUM(members_enrolled),0) AS enrolled,
      IFNULL(SUM(staff_users),0) AS staff,
      IFNULL(SUM(wallets_total_cents),0) AS wallets_cents,
      IFNULL(SUM(loans_active),0) AS loans_active,
      IFNULL(SUM(loans_outstanding_cents),0) AS loans_cents,
      IFNULL(SUM(fds_count),0) AS fds_count,
      IFNULL(SUM(fds_value_cents),0) AS fds_cents,
      IFNULL(SUM(pending_requests),0) AS pending
      FROM tenant_stats_current`);
    const [rows] = await pool.query(`
      SELECT s.slug, s.name_en, s.join_code, s.status,
             c.captured_at, c.reachable, c.members_total, c.members_active,
             c.wallets_total_cents, c.loans_outstanding_cents, c.pending_requests,
             c.last_txn_at, c.migration_version,
             (c.last_txn_at IS NULL OR c.last_txn_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS stale
      FROM samithis s LEFT JOIN tenant_stats_current c ON c.samithi_slug = s.slug
      ORDER BY s.slug`);

    res.json({
      samithis: { total: Number(reg.total), active: Number(reg.active), suspended: Number(reg.suspended) },
      totals: {
        members: Number(agg.members), enrolled: Number(agg.enrolled), staff: Number(agg.staff),
        wallets_cents: Number(agg.wallets_cents), loans_active: Number(agg.loans_active),
        loans_outstanding_cents: Number(agg.loans_cents), fds_count: Number(agg.fds_count),
        fds_value_cents: Number(agg.fds_cents), pending_requests: Number(agg.pending)
      },
      at_a_glance: rows
    });
  } catch (err) { next(err); }
});

// POST /pa/v1/dashboard/refresh — on-demand fleet sweep (FR-2.1)
router.post('/refresh', async (_req, res, next) => {
  try {
    const results = await collectAll();
    res.locals.audit = { action: 'dashboard_refresh' };
    res.json({ swept: results.length, ok: results.filter((r) => r.ok).length, results });
  } catch (err) { next(err); }
});

module.exports = router;
