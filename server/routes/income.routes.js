const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

// GET /api/v1/income?page=&limit=&from=&to=&search=&type_id=
// Returns { transactions, total }. Without pagination params it returns
// everything (used by CSV export).
router.get('/', async (req, res, next) => {
  try {
    const { from, to, search, type_id } = req.query;
    const where = [];
    const params = [];

    if (from) { where.push('i.date >= ?'); params.push(from); }
    if (to) { where.push('i.date <= ?'); params.push(to); }
    if (type_id) { where.push('i.income_type_id = ?'); params.push(parseInt(type_id)); }
    if (search && search.trim()) {
      where.push('(m.full_name LIKE ? OR i.guest_name LIKE ? OR m.nic LIKE ? OR t.name LIKE ? OR i.notes LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const baseFrom = `
      FROM income_ledger i
      JOIN wallets w ON i.wallet_id = w.id
      JOIN income_types t ON i.income_type_id = t.id
      LEFT JOIN members m ON i.member_id = m.id
      ${whereClause}
    `;

    const [countRows] = await getPool().query(`SELECT COUNT(*) as total, COALESCE(SUM(CASE WHEN i.status = 'Active' THEN i.amount ELSE 0 END), 0) as active_total ${baseFrom}`, params);
    const total = Number(countRows[0].total);
    const activeTotal = Number(countRows[0].active_total);

    let limitClause = '';
    if (req.query.page || req.query.limit) {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 25, 500);
      limitClause = `LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    }

    const [rows] = await getPool().query(`
      SELECT i.*, w.name as wallet_name, t.name as income_type_name, t.code as income_type_code,
             COALESCE(m.full_name, i.guest_name) as payer_name,
             m.nic as member_nic
      ${baseFrom}
      ORDER BY i.date DESC, i.id DESC
      ${limitClause}
    `, params);

    res.json({
      transactions: rows.map(r => ({
        ...r,
        amount: Number(r.amount),
        principal_part: Number(r.principal_part),
        interest_part: Number(r.interest_part)
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

    const [typeRows] = await conn.query('SELECT id, name, code FROM income_types WHERE id = ?', [d.income_type_id]);
    if (typeRows.length === 0) throw Object.assign(new Error('Income type not found'), { statusCode: 400 });
    const typeCode = typeRows[0].code;

    // Loan repayments are handled exclusively by the Loan module, which
    // generates these ledger entries automatically.
    if (typeCode === 'loan_interest' || typeCode === 'loan_fine') {
      throw Object.assign(new Error('Loan-related income cannot be recorded manually. Record a repayment in the Loan Portfolio instead.'), { statusCode: 400 });
    }

    // Membership Fee, Entrance Fee, and Fine are always tied to a member
    if (['membership_fee', 'entrance_fee', 'fine'].includes(typeCode) && !d.member_id) {
      throw Object.assign(new Error(`${typeRows[0].name} must be recorded against a registered member`), { statusCode: 400 });
    }

    // Membership Fee and Entrance Fee are one-time payments per member
    if ((typeCode === 'membership_fee' || typeCode === 'entrance_fee') && d.member_id) {
      const [existing] = await conn.query(
        `SELECT COUNT(*) as count FROM income_ledger
         WHERE member_id = ? AND income_type_id = ? AND status = 'Active'`,
        [d.member_id, d.income_type_id]
      );
      if (Number(existing[0].count) > 0) {
        throw Object.assign(new Error(`This member already has a ${typeRows[0].name} recorded. Only one is allowed per member.`), { statusCode: 400 });
      }
    }

    const [result] = await conn.query(
      `INSERT INTO income_ledger (
        date, payer_type, member_id, guest_name, income_type_id,
        amount, principal_part, interest_part, months_covered,
        fine_reason, payment_method, wallet_id, asset_id, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [d.date, d.payer_type, d.member_id || null, d.guest_name || null,
       d.income_type_id, d.amount, d.principal_part || 0, d.interest_part || 0,
       d.months_covered || null, d.fine_reason || null, d.payment_method,
       d.wallet_id, d.asset_id || null, d.notes || null]
    );

    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [d.amount, d.wallet_id]);

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

    const [ledger] = await conn.query('SELECT amount, wallet_id, status, loan_id FROM income_ledger WHERE id = ?', [id]);
    if (ledger.length === 0) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    if (ledger[0].status === 'Void') throw Object.assign(new Error('Transaction is already voided'), { statusCode: 400 });
    // Loan-generated entries carry loan balance state — voiding them here would
    // desync the loan. They must be corrected through the Loan module.
    if (ledger[0].loan_id) throw Object.assign(new Error('This entry was auto-generated by the Loan module and cannot be voided from the Income ledger.'), { statusCode: 400 });

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [Number(ledger[0].amount), ledger[0].wallet_id]);
    await conn.query("UPDATE income_ledger SET status = 'Void', void_reason = ? WHERE id = ?", [reason, id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.delete('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    
    const [ledger] = await conn.query('SELECT status FROM income_ledger WHERE id = ?', [id]);
    if (ledger.length === 0) throw Object.assign(new Error('Transaction not found'), { statusCode: 404 });
    if (ledger[0].status !== 'Void') throw Object.assign(new Error('Only voided transactions can be permanently deleted'), { statusCode: 400 });

    await conn.query('DELETE FROM income_ledger WHERE id = ?', [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

module.exports = router;
