const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { isMigrationMode } = require('../lib/settings');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query('SELECT * FROM wallets ORDER BY name ASC');
    // Convert numeric fields from potential BigInt
    res.json(rows.map(w => ({ ...w, balance: Number(w.balance), is_active: Number(w.is_active) })));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, wallet_type, opening_balance } = req.body;
    let balance = opening_balance || 0;
    if (balance > 0 && !(await isMigrationMode())) {
      throw Object.assign(new Error('Opening balances can only be entered during Migration Mode. In the live system, funds must enter wallets through Income transactions or transfers.'), { statusCode: 400 });
    }
    const [result] = await getPool().query('INSERT INTO wallets (name, wallet_type, balance) VALUES (?, ?, ?)', [name, wallet_type, balance]);
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { name, wallet_type } = req.body;
    await getPool().query('UPDATE wallets SET name=?, wallet_type=? WHERE id=?', [name, wallet_type, parseInt(req.params.id)]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.patch('/:id/toggle', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await getPool().query('SELECT is_active, balance FROM wallets WHERE id = ?', [id]);
    if (rows.length === 0) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });

    const wallet = rows[0];
    if (Number(wallet.is_active) === 1 && Number(wallet.balance) > 0) {
      throw Object.assign(new Error('Cannot inactivate a wallet with a balance > 0. Transfer funds first.'), { statusCode: 400 });
    }
    const newStatus = Number(wallet.is_active) === 1 ? 0 : 1;
    await getPool().query('UPDATE wallets SET is_active = ? WHERE id = ?', [newStatus, id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/transfer', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const { fromId, toId, amount } = req.body;

    const [fromRows] = await conn.query('SELECT balance FROM wallets WHERE id = ? AND is_active = 1', [fromId]);
    if (fromRows.length === 0) throw Object.assign(new Error('Source wallet not found or inactive'), { statusCode: 400 });
    if (Number(fromRows[0].balance) < amount) throw Object.assign(new Error('Insufficient funds in source wallet'), { statusCode: 400 });

    const [toRows] = await conn.query('SELECT id FROM wallets WHERE id = ? AND is_active = 1', [toId]);
    if (toRows.length === 0) throw Object.assign(new Error('Destination wallet not found or inactive'), { statusCode: 400 });

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [amount, fromId]);
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, toId]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.post('/:id/deposit', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);
    const { amount, note } = req.body;

    // Direct deposits are opening-balance adjustments — Migration Mode only.
    // In the live system all money entering a wallet must go through Income,
    // loan repayments, or wallet transfers.
    if (!(await isMigrationMode(conn))) {
      throw Object.assign(new Error('Opening balances are no longer editable. Use an Income transaction to add funds to a wallet.'), { statusCode: 400 });
    }

    const [wallet] = await conn.query('SELECT id, is_active FROM wallets WHERE id = ?', [id]);
    if (wallet.length === 0) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!Number(wallet[0].is_active)) throw Object.assign(new Error('Cannot deposit to an inactive wallet'), { statusCode: 400 });

    // Migration-mode balance entry establishes the current financial position
    // without recreating historical income transactions.
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [amount, id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

router.delete('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);

    const [walletRows] = await conn.query('SELECT balance FROM wallets WHERE id = ?', [id]);
    if (walletRows.length === 0) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    // A positive balance is real money that would vanish with the wallet. A
    // negative balance is only ever a bookkeeping artefact, so it may be deleted.
    if (Number(walletRows[0].balance) > 0) {
      throw Object.assign(new Error('Cannot delete a wallet that still holds funds. Transfer its balance to another wallet first.'), { statusCode: 400 });
    }

    // Only *live* references should block deletion — the error message promises
    // this. Withdrawn FDs, settled loans and voided ledger rows are historical.
    const [incomeRef] = await conn.query("SELECT COUNT(*) as count FROM income_ledger WHERE wallet_id = ? AND status = 'Active'", [id]);
    const [expenseRef] = await conn.query("SELECT COUNT(*) as count FROM expense_ledger WHERE wallet_id = ? AND status = 'Active'", [id]);
    const [loanRef] = await conn.query("SELECT COUNT(*) as count FROM loans WHERE disbursement_wallet_id = ? AND status IN ('Active', 'Overdue')", [id]);
    const [fdRef] = await conn.query("SELECT COUNT(*) as count FROM fixed_deposits WHERE linked_wallet_id = ? AND status = 'Active'", [id]);

    if (Number(incomeRef[0].count) > 0 || Number(expenseRef[0].count) > 0 || Number(loanRef[0].count) > 0 || Number(fdRef[0].count) > 0) {
      throw Object.assign(new Error('Cannot delete a wallet that has active transactions, loans, or fixed deposits linked to it. Transfer funds and resolve those first.'), { statusCode: 400 });
    }

    // Ledger rows carry a NOT NULL wallet_id foreign key and must be kept for
    // audit, so a wallet with any transaction history can't be hard-deleted —
    // it can only be inactivated. Loans/FDs use nullable FKs, so their closed
    // rows can simply be detached before the delete.
    const [ledgerHistory] = await conn.query(
      "SELECT (SELECT COUNT(*) FROM income_ledger WHERE wallet_id = ?) + (SELECT COUNT(*) FROM expense_ledger WHERE wallet_id = ?) AS count",
      [id, id]
    );
    if (Number(ledgerHistory[0].count) > 0) {
      throw Object.assign(new Error('This wallet has transaction history and cannot be deleted. Inactivate it instead to preserve the records.'), { statusCode: 400 });
    }

    await conn.query('UPDATE fixed_deposits SET linked_wallet_id = NULL WHERE linked_wallet_id = ?', [id]);
    await conn.query('UPDATE loans SET disbursement_wallet_id = NULL WHERE disbursement_wallet_id = ?', [id]);
    await conn.query('DELETE FROM wallets WHERE id = ?', [id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback().catch(() => {}); next(err); } finally { conn.release(); }
});

module.exports = router;
