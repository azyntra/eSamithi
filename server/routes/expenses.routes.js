const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/expenses?page=&limit=&from=&to=&search=&type_id=
// Returns { transactions, total }. Without pagination params it returns
// everything (used by CSV export).
router.get('/', async (req, res, next) => {
  try {
    const { from, to, search, type_id } = req.query;
    const where = [];
    const params = [];

    if (from) { where.push('e.date >= ?'); params.push(from); }
    if (to) { where.push('e.date <= ?'); params.push(to); }
    if (type_id) { where.push('e.expense_type_id = ?'); params.push(parseInt(type_id)); }
    if (search && search.trim()) {
      where.push('(m.full_name LIKE ? OR e.vendor_name LIKE ? OR m.nic LIKE ? OR t.name LIKE ? OR e.voucher_no LIKE ? OR e.notes LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const baseFrom = `
      FROM expense_ledger e
      JOIN wallets w ON e.wallet_id = w.id
      JOIN expense_types t ON e.expense_type_id = t.id
      LEFT JOIN members m ON e.member_id = m.id
      ${whereClause}
    `;

    const [countRows] = await getPool().query(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN e.status = 'Active' THEN e.amount ELSE 0 END), 0) as active_total ${baseFrom}`, params);
    const total = Number(countRows[0].total);
    const activeTotal = Number(countRows[0].active_total);

    let limitClause = '';
    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 25, 500);
      limitClause = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    }

    const [rows] = await getPool().query(`
      SELECT e.*, w.name as wallet_name, t.name as expense_type_name, t.code as expense_type_code,
             COALESCE(m.full_name, e.vendor_name) as recipient_name,
             m.nic as member_nic
      ${baseFrom}
      ORDER BY e.date DESC, e.id DESC
      ${limitClause}
    `, params);

    res.json({
      transactions: rows.map(r => ({
        ...r,
        amount: Number(r.amount),
        quantity: Number(r.quantity),
        unit_price: Number(r.unit_price)
      })),
      total,
      active_total: activeTotal
    });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;

    const [wallet] = await conn.query('SELECT balance FROM wallets WHERE id = ?', [d.wallet_id]);
    if (wallet.length === 0) throw Object.assign(new Error('Selected wallet not found'), { statusCode: 404 });
    if (Number(wallet[0].balance) < d.amount) throw Object.assign(new Error('Insufficient funds in the selected wallet'), { statusCode: 400 });

    const [result] = await conn.query(
      `INSERT INTO expense_ledger (
        date, recipient_type, member_id, vendor_name, expense_type_id,
        amount, quantity, unit_price, death_reference, payment_method,
        wallet_id, voucher_no, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [d.date, d.recipient_type, d.member_id || null, d.vendor_name || null,
       d.expense_type_id, d.amount, d.quantity || 1, d.unit_price || 0,
       d.death_reference || null, d.payment_method, d.wallet_id,
       d.voucher_no || null, d.notes || null]
    );

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [d.amount, d.wallet_id]);

    await conn.commit();
    res.json({ success: true, id: result.insertId });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.patch('/:id/void', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    const { reason } = req.body;

    const [ledger] = await conn.query('SELECT amount, wallet_id, status FROM expense_ledger WHERE id = ?', [id]);
    if (ledger.length === 0) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    if (ledger[0].status === 'Void') throw Object.assign(new Error('Transaction is already voided'), { statusCode: 400 });

    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [Number(ledger[0].amount), ledger[0].wallet_id]);
    await conn.query("UPDATE expense_ledger SET status = 'Void', void_reason = ? WHERE id = ?", [reason, id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.delete('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    
    const [ledger] = await conn.query('SELECT status FROM expense_ledger WHERE id = ?', [id]);
    if (ledger.length === 0) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    if (ledger[0].status !== 'Void') throw Object.assign(new Error('Only voided transactions can be permanently deleted'), { statusCode: 400 });

    await conn.query('DELETE FROM expense_ledger WHERE id = ?', [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

module.exports = router;
