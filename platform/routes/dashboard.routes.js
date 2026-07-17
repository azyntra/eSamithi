const express = require('express');
const { getPool } = require('../db');
const { collectAll } = require('../lib/collector');
const { TREND_METRICS, sumOf, numeric } = require('../lib/metrics');

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
      IFNULL(SUM(pending_requests),0) AS pending,
      IFNULL(SUM(loans_overdue),0) AS loans_overdue,
      IFNULL(SUM(push_tokens),0) AS push_tokens,
      IFNULL(SUM(locked_pins),0) AS locked_pins,
      IFNULL(SUM(month_income_cents),0) AS month_income_cents,
      IFNULL(SUM(month_expense_cents),0) AS month_expense_cents,
      SUM(reachable = 0) AS unreachable
      FROM tenant_stats_current`);
    const [rows] = await pool.query(`
      SELECT s.slug, s.name_en, s.join_code, s.status,
             c.captured_at, c.reachable, c.members_total, c.members_active,
             c.members_enrolled, c.wallets_total_cents, c.loans_outstanding_cents,
             c.loans_overdue, c.pending_requests, c.last_txn_at, c.migration_version,
             (c.last_txn_at IS NULL OR c.last_txn_at < DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS stale
      FROM samithis s LEFT JOIN tenant_stats_current c ON c.samithi_slug = s.slug
      ORDER BY s.slug`);
    const [[fresh]] = await pool.query('SELECT MAX(captured_at) AS captured_at FROM tenant_stats_current');

    // Baseline for the tile deltas: the oldest daily snapshot still inside the
    // last week. Absent until the collector has a second day of history, in
    // which case the console simply shows no delta.
    const [[baseline]] = await pool.query(`
      SELECT ${sumOf(['members_total', 'members_enrolled', 'wallets_total_cents', 'loans_outstanding_cents', 'fds_value_cents', 'push_tokens'])}
      FROM tenant_stats_history
      WHERE snapshot_date = (
        SELECT MIN(snapshot_date) FROM tenant_stats_history
        WHERE snapshot_date >= CURDATE() - INTERVAL 7 DAY AND snapshot_date < CURDATE()
      )`);
    const [[{ days_of_history }]] = await pool.query(
      'SELECT COUNT(DISTINCT snapshot_date) AS days_of_history FROM tenant_stats_history'
    );

    res.json({
      samithis: { total: Number(reg.total), active: Number(reg.active), suspended: Number(reg.suspended) },
      totals: {
        members: Number(agg.members), enrolled: Number(agg.enrolled), staff: Number(agg.staff),
        wallets_cents: Number(agg.wallets_cents), loans_active: Number(agg.loans_active),
        loans_outstanding_cents: Number(agg.loans_cents), fds_count: Number(agg.fds_count),
        fds_value_cents: Number(agg.fds_cents), pending_requests: Number(agg.pending),
        loans_overdue: Number(agg.loans_overdue), push_tokens: Number(agg.push_tokens),
        locked_pins: Number(agg.locked_pins), month_income_cents: Number(agg.month_income_cents),
        month_expense_cents: Number(agg.month_expense_cents)
      },
      attention: {
        unreachable: Number(agg.unreachable || 0),
        stale: rows.filter((r) => r.status === 'active' && Number(r.stale)).length,
        loans_overdue: Number(agg.loans_overdue),
        locked_pins: Number(agg.locked_pins)
      },
      // null until a prior day exists — the console hides deltas rather than
      // pretending today's numbers are a change from nothing.
      baseline: days_of_history > 1 && baseline.members_total !== null ? numeric(baseline) : null,
      as_of: fresh.captured_at,
      at_a_glance: rows
    });
  } catch (err) { next(err); }
});

// GET /pa/v1/dashboard/trends?days=N — fleet daily series for the trend chart
router.get('/trends', async (req, res, next) => {
  try {
    const days = Math.max(7, Math.min(365, parseInt(req.query.days, 10) || 30));
    const [series] = await getPool().query(`
      SELECT DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date, ${sumOf(TREND_METRICS)}
      FROM tenant_stats_history
      WHERE snapshot_date >= CURDATE() - INTERVAL ? DAY
      GROUP BY snapshot_date ORDER BY snapshot_date`, [days]);
    res.json({ days, series: series.map((r) => numeric(r, ['date'])) });
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
