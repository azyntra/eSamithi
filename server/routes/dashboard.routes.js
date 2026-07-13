const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { isMigrationMode } = require('../lib/settings');
const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/dashboard/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const pool = getPool();

    const [membersCount] = await pool.query("SELECT COUNT(*) as count FROM members WHERE is_active = 1 OR is_active IS NULL");
    const [walletsBal] = await pool.query("SELECT IFNULL(SUM(balance), 0) as total FROM wallets WHERE is_active = 1");
    const [fdBal] = await pool.query("SELECT IFNULL(SUM(principal), 0) as total FROM fixed_deposits WHERE status = 'Active'");
    const [loansBal] = await pool.query("SELECT IFNULL(SUM(principal_owed + interest_owed + fines_owed), 0) as total, COUNT(*) as count FROM loans WHERE status IN ('Active', 'Overdue')");

    const currentYear = new Date().getFullYear().toString();

    const [monthlyIncome] = await pool.query(
      `SELECT LPAD(MONTH(date), 2, '0') as month, SUM(amount) as total
       FROM income_ledger WHERE status = 'Active' AND YEAR(date) = ?
       GROUP BY month ORDER BY month`, [currentYear]
    );

    const [monthlyExpenses] = await pool.query(
      `SELECT LPAD(MONTH(date), 2, '0') as month, SUM(amount) as total
       FROM expense_ledger WHERE status = 'Active' AND YEAR(date) = ?
       GROUP BY month ORDER BY month`, [currentYear]
    );

    const [recentIncome] = await pool.query(
      `SELECT 'Income' as type, amount, date,
       (CASE WHEN payer_type = 'Member' THEN (SELECT full_name FROM members WHERE id = member_id) ELSE guest_name END) as name
       FROM income_ledger WHERE status = 'Active' ORDER BY date DESC, id DESC LIMIT 5`
    );

    const [recentExpenses] = await pool.query(
      `SELECT 'Expense' as type, amount, date,
       (CASE WHEN recipient_type = 'Member' THEN (SELECT full_name FROM members WHERE id = member_id) ELSE vendor_name END) as name
       FROM expense_ledger WHERE status = 'Active' ORDER BY date DESC, id DESC LIMIT 5`
    );

    // "Attention needed" card: what the treasurer should chase this week
    const [overdue] = await pool.query("SELECT COUNT(*) as count FROM loans WHERE status = 'Overdue'");
    const [fdSoon] = await pool.query(
      "SELECT COUNT(*) as count FROM fixed_deposits WHERE status = 'Active' AND maturity_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)"
    );
    let membersWithoutFee = null;
    if (!(await isMigrationMode(pool))) {
      const [rows] = await pool.query(
        `SELECT COUNT(*) as count FROM members m
         WHERE (m.is_active = 1 OR m.is_active IS NULL)
           AND NOT EXISTS (
             SELECT 1 FROM income_ledger il
             JOIN income_types it ON it.id = il.income_type_id
             WHERE il.member_id = m.id AND il.status = 'Active' AND it.code = 'membership_fee'
           )`
      );
      membersWithoutFee = Number(rows[0].count);
    }

    const recentActivity = [...recentIncome, ...recentExpenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    res.json({
      totalMembers: Number(membersCount[0].count) || 0,
      totalLiquid: Number(walletsBal[0].total) || 0,
      totalFDs: Number(fdBal[0].total) || 0,
      totalLoansOwed: Number(loansBal[0].total) || 0,
      activeLoansCount: Number(loansBal[0].count) || 0,
      attention: {
        overdueLoans: Number(overdue[0].count) || 0,
        fdsMaturingSoon: Number(fdSoon[0].count) || 0,
        membersWithoutFee
      },
      chartData: {
        income: monthlyIncome.map(r => ({ month: r.month, total: Number(r.total) })),
        expenses: monthlyExpenses.map(r => ({ month: r.month, total: Number(r.total) }))
      },
      recentActivity: recentActivity.map(r => ({ ...r, amount: Number(r.amount) }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
