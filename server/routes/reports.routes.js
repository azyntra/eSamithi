const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { isMigrationMode } = require('../lib/settings');
const { usageStatus, ONLINE_SECONDS, ACTIVE_DAYS, OCCASIONAL_DAYS } = require('../lib/memberActivity');
const router = express.Router();
router.use(authMiddleware);

// Category breakdown of the active ledger rows between two dates (inclusive)
async function categoryTotals(pool, table, typeTable, typeFk, from, to) {
  const [rows] = await pool.query(
    `SELECT t.name, t.code, COUNT(l.id) as entry_count, IFNULL(SUM(l.amount), 0) as total
     FROM ${table} l
     JOIN ${typeTable} t ON t.id = l.${typeFk}
     WHERE l.status = 'Active' AND l.date >= ? AND l.date <= ?
     GROUP BY t.id, t.name, t.code
     ORDER BY total DESC`,
    [from, to]
  );
  return rows.map(r => ({
    name: r.name,
    code: r.code,
    entry_count: Number(r.entry_count),
    total: Number(r.total)
  }));
}

async function summarize(pool, from, to) {
  const income = await categoryTotals(pool, 'income_ledger', 'income_types', 'income_type_id', from, to);
  const expenses = await categoryTotals(pool, 'expense_ledger', 'expense_types', 'expense_type_id', from, to);
  const incomeTotal = income.reduce((s, r) => s + r.total, 0);
  const expenseTotal = expenses.reduce((s, r) => s + r.total, 0);
  return { income, expenses, totals: { income: incomeTotal, expenses: expenseTotal, net: incomeTotal - expenseTotal } };
}

// GET /api/v1/reports/monthly?year=2026&month=7
router.get('/monthly', async (req, res, next) => {
  try {
    const pool = getPool();
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = Math.min(Math.max(parseInt(req.query.month) || new Date().getMonth() + 1, 1), 12);
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    res.json({ year, month, from, to, ...(await summarize(pool, from, to)) });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/annual?year=2026 — AGM statement: year's ledger plus
// the society's position (cash, FDs, loans, members) as of now
router.get('/annual', async (req, res, next) => {
  try {
    const pool = getPool();
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const summary = await summarize(pool, `${year}-01-01`, `${year}-12-31`);

    const [members] = await pool.query('SELECT COUNT(*) as count FROM members WHERE is_active = 1 OR is_active IS NULL');
    const [wallets] = await pool.query('SELECT IFNULL(SUM(balance), 0) as total FROM wallets WHERE is_active = 1');
    const [fds] = await pool.query("SELECT IFNULL(SUM(principal), 0) as total, COUNT(*) as count FROM fixed_deposits WHERE status = 'Active'");
    const [loans] = await pool.query(
      `SELECT IFNULL(SUM(principal_owed + interest_owed + fines_owed), 0) as total, COUNT(*) as count
       FROM loans WHERE status IN ('Active', 'Overdue')`
    );

    res.json({
      year,
      ...summary,
      position: {
        members: Number(members[0].count),
        walletBalance: Number(wallets[0].total),
        fdPrincipal: Number(fds[0].total),
        fdCount: Number(fds[0].count),
        loansOutstanding: Number(loans[0].total),
        activeLoans: Number(loans[0].count)
      }
    });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/arrears — who/what needs chasing
router.get('/arrears', async (req, res, next) => {
  try {
    const pool = getPool();

    const [overdueLoans] = await pool.query(
      `SELECT l.id, l.principal_owed, l.interest_owed, l.fines_owed, l.date_issued,
              m.full_name as member_name, m.society_id, m.phone
       FROM loans l JOIN members m ON m.id = l.member_id
       WHERE l.status = 'Overdue'
       ORDER BY (l.interest_owed + l.fines_owed) DESC`
    );

    const [fdsMaturing] = await pool.query(
      `SELECT id, fd_number, bank_name, principal, maturity_date
       FROM fixed_deposits
       WHERE status = 'Active' AND maturity_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       ORDER BY maturity_date ASC`
    );

    // Membership-fee arrears only make sense once live — during migration the
    // historical fee payments were never entered
    let membersWithoutFee = null;
    if (!(await isMigrationMode(pool))) {
      const [rows] = await pool.query(
        `SELECT m.id, m.society_id, m.full_name, m.phone
         FROM members m
         WHERE (m.is_active = 1 OR m.is_active IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM income_ledger il
             JOIN income_types it ON it.id = il.income_type_id
             WHERE il.member_id = m.id AND il.status = 'Active' AND it.code = 'membership_fee'
           )
         ORDER BY m.society_id ASC`
      );
      membersWithoutFee = rows;
    }

    res.json({
      overdueLoans: overdueLoans.map(l => ({
        ...l,
        principal_owed: Number(l.principal_owed),
        interest_owed: Number(l.interest_owed),
        fines_owed: Number(l.fines_owed)
      })),
      fdsMaturing: fdsMaturing.map(f => ({ ...f, principal: Number(f.principal) })),
      membersWithoutFee
    });
  } catch (err) { next(err); }
});

// GET /api/v1/reports/app-usage — who is using the member mobile app.
// Every active member, bucketed by enrolment (PIN set) and when the app last
// talked to the server. "Installed" is not knowable per member (the store
// only reports anonymous counts), so "not enrolled" is the closest signal:
// the member has never completed NIC + date-of-birth + PIN setup.
router.get('/app-usage', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT m.id, m.society_id, m.full_name, m.phone,
              (m.pin_hash IS NOT NULL)                          AS enrolled,
              (m.app_enabled IS NULL OR m.app_enabled = 1)      AS app_enabled,
              (m.pin_locked_until IS NOT NULL AND m.pin_locked_until > NOW()) AS pin_locked,
              UNIX_TIMESTAMP(m.pin_set_at)                      AS enrolled_ts,
              UNIX_TIMESTAMP(a.first_seen_at)                   AS first_seen_ts,
              UNIX_TIMESTAMP(a.last_seen_at)                    AS last_seen_ts,
              TIMESTAMPDIFF(SECOND, a.last_seen_at, NOW())      AS seconds_ago,
              a.app_version,
              COALESCE(a.platform, p.platform)                  AS platform,
              (p.member_id IS NOT NULL)                         AS push_enabled
       FROM members m
       LEFT JOIN member_app_activity a ON a.member_id = m.id
       LEFT JOIN (SELECT member_id, MAX(platform) AS platform
                  FROM member_push_tokens GROUP BY member_id) p ON p.member_id = m.id
       WHERE m.is_active = 1 OR m.is_active IS NULL
       ORDER BY m.full_name ASC, m.id ASC`
    );

    const iso = (ts) => (ts === null || ts === undefined ? null : new Date(Number(ts) * 1000).toISOString());
    const counts = { total: 0, enrolled: 0, not_enrolled: 0, online: 0, active: 0, occasional: 0, dormant: 0, blocked: 0 };

    const members = rows.map((r) => {
      const enrolled = Number(r.enrolled) === 1;
      const secondsAgo = r.seconds_ago === null ? null : Math.max(0, Number(r.seconds_ago));
      const status = usageStatus({ enrolled, appEnabled: Number(r.app_enabled) === 1, secondsAgo });
      counts.total += 1;
      counts[status] += 1;
      if (enrolled) counts.enrolled += 1;
      return {
        id: r.id,
        society_id: r.society_id,
        full_name: r.full_name,
        phone: r.phone,
        status,
        enrolled,
        enrolled_at: iso(r.enrolled_ts),
        first_seen_at: iso(r.first_seen_ts),
        last_seen_at: iso(r.last_seen_ts),
        platform: r.platform || null,
        app_version: r.app_version || null,
        push_enabled: Number(r.push_enabled) === 1,
        pin_locked: Number(r.pin_locked) === 1
      };
    });

    res.json({
      generated_at: new Date().toISOString(),
      thresholds: { online_minutes: ONLINE_SECONDS / 60, active_days: ACTIVE_DAYS, occasional_days: OCCASIONAL_DAYS },
      counts,
      members
    });
  } catch (err) { next(err); }
});

module.exports = router;
