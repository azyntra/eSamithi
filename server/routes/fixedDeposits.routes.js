const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT f.*, w.name as linked_wallet_name
      FROM fixed_deposits f
      LEFT JOIN wallets w ON f.linked_wallet_id = w.id
      ORDER BY f.status ASC, f.maturity_date ASC
    `);
    res.json(rows.map(r => ({
      ...r,
      principal: Number(r.principal),
      term_months: Number(r.term_months),
      interest_rate: Number(r.interest_rate)
    })));
  } catch (err) { next(err); }
});

// POST /api/v1/fixed-deposits — optionally funds the FD from the linked wallet
// (fund_from_wallet=true means new society money moving into the FD; existing
// paper-record FDs entered during migration should leave it false).
router.post('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;

    if (d.fund_from_wallet) {
      if (!d.linked_wallet_id) throw Object.assign(new Error('Select a linked wallet to fund the FD from'), { statusCode: 400 });
      const [wallet] = await conn.query('SELECT balance, is_active FROM wallets WHERE id = ? FOR UPDATE', [d.linked_wallet_id]);
      if (wallet.length === 0) throw Object.assign(new Error('Linked wallet not found'), { statusCode: 404 });
      if (!Number(wallet[0].is_active)) throw Object.assign(new Error('Linked wallet is inactive'), { statusCode: 400 });
      if (Number(wallet[0].balance) < d.principal) throw Object.assign(new Error('Insufficient funds in the linked wallet to fund this FD'), { statusCode: 400 });
      await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [d.principal, d.linked_wallet_id]);
    }

    const [result] = await conn.query(
      `INSERT INTO fixed_deposits (fd_number, bank_name, principal, interest_rate, term_months, start_date, maturity_date, notes, linked_wallet_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [d.fd_number, d.bank_name, d.principal, d.interest_rate, d.term_months, d.start_date, d.maturity_date, d.notes || null, d.linked_wallet_id || null]
    );
    await conn.commit();
    res.json({ success: true, id: result.insertId });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const d = req.body;
    await getPool().query(
      `UPDATE fixed_deposits SET fd_number=?, bank_name=?, principal=?, interest_rate=?, term_months=?, start_date=?, maturity_date=?, notes=?, linked_wallet_id=?
       WHERE id=?`,
      [d.fd_number, d.bank_name, d.principal, d.interest_rate, d.term_months, d.start_date, d.maturity_date, d.notes || null, d.linked_wallet_id || null, parseInt(req.params.id)]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/v1/fixed-deposits/:id/withdraw — close the FD and return the
// principal to the linked wallet (capital movement, not income).
router.patch('/:id/withdraw', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);

    const [rows] = await conn.query('SELECT status, principal, linked_wallet_id FROM fixed_deposits WHERE id = ? FOR UPDATE', [id]);
    if (rows.length === 0) throw Object.assign(new Error('FD not found'), { statusCode: 404 });
    if (rows[0].status === 'Withdrawn') throw Object.assign(new Error('FD has already been withdrawn'), { statusCode: 400 });

    if (rows[0].linked_wallet_id) {
      const [wallet] = await conn.query('SELECT is_active FROM wallets WHERE id = ?', [rows[0].linked_wallet_id]);
      if (wallet.length > 0 && Number(wallet[0].is_active) === 1) {
        await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [Number(rows[0].principal), rows[0].linked_wallet_id]);
      }
    }

    await conn.query("UPDATE fixed_deposits SET status = 'Withdrawn' WHERE id = ?", [id]);
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await getPool().query('DELETE FROM fixed_deposits WHERE id = ?', [parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
