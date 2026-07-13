const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { isMigrationMode } = require('../lib/settings');
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

module.exports = router;
