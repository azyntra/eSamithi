const express = require('express');
const { getPool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { getSetting, isMigrationMode } = require('../lib/settings');
// Accrual engine lives in lib/ so the member app's /me routes share it
const { accrueLoan, getRates } = require('../lib/loanAccrual');
const router = express.Router();
router.use(authMiddleware);

async function getIncomeTypeIdByCode(conn, code) {
  const [rows] = await conn.query('SELECT id FROM income_types WHERE code = ? LIMIT 1', [code]);
  if (rows.length === 0) {
    throw Object.assign(new Error(`System income type "${code}" is missing. Run migration 003 to seed it.`), { statusCode: 500 });
  }
  return rows[0].id;
}

// GET /api/v1/loans — accrues pending interest/fines, then lists the portfolio
router.get('/', async (_req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const { interestRate, fineRate } = await getRates(conn);

    const [activeLoans] = await conn.query("SELECT id FROM loans WHERE status IN ('Active', 'Overdue')");
    for (const l of activeLoans) {
      await accrueLoan(conn, l.id, interestRate, fineRate);
    }
    await conn.commit();

    const [rows] = await conn.query(`
      SELECT l.*, m.full_name as member_name, m.nic as member_nic,
             w.name as disbursement_wallet_name,
             (SELECT COUNT(*) FROM loan_guarantors WHERE loan_id = l.id) as guarantor_count
      FROM loans l
      JOIN members m ON l.member_id = m.id
      LEFT JOIN wallets w ON l.disbursement_wallet_id = w.id
      ORDER BY l.date_issued DESC, l.id DESC
    `);
    res.json(rows.map(r => ({
      ...r,
      principal_amount: Number(r.principal_amount),
      principal_owed: Number(r.principal_owed),
      interest_owed: Number(r.interest_owed),
      fines_owed: Number(r.fines_owed),
      is_migrated: Number(r.is_migrated),
      guarantor_count: Number(r.guarantor_count)
    })));
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

// Shared issuance validations (Req 5)
async function validateLoanRules(conn, memberId, principalAmount, guarantorIds) {
  const maxLimit = Number(await getSetting('max_loan_limit', conn)) || 0;
  if (maxLimit > 0 && principalAmount > maxLimit) {
    throw Object.assign(new Error(`Loan amount exceeds the maximum loan limit of ${maxLimit / 100} configured in Settings`), { statusCode: 400 });
  }

  const [activeLoan] = await conn.query(
    "SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status IN ('Active', 'Overdue')",
    [memberId]
  );
  if (Number(activeLoan[0].count) > 0) {
    throw Object.assign(new Error('This member already has an active loan. A borrower cannot hold more than one active loan.'), { statusCode: 400 });
  }

  const ids = (guarantorIds || []).map(Number);
  if (ids.length !== 2 || ids[0] === ids[1]) {
    throw Object.assign(new Error('Exactly two different guarantors must be selected'), { statusCode: 400 });
  }
  if (ids.includes(Number(memberId))) {
    throw Object.assign(new Error('The borrower cannot be their own guarantor'), { statusCode: 400 });
  }
  for (const gid of ids) {
    const [gRows] = await conn.query(
      `SELECT COUNT(*) as count FROM loan_guarantors lg
       JOIN loans l ON lg.loan_id = l.id
       WHERE lg.member_id = ? AND l.status IN ('Active', 'Overdue')`,
      [gid]
    );
    if (Number(gRows[0].count) >= 2) {
      const [nameRows] = await conn.query('SELECT full_name FROM members WHERE id = ?', [gid]);
      const name = nameRows.length > 0 ? nameRows[0].full_name : `Member #${gid}`;
      throw Object.assign(new Error(`${name} is already guaranteeing 2 active loans and cannot guarantee another`), { statusCode: 400 });
    }
  }
  return ids;
}

// POST /api/v1/loans — issue a new loan (deducts from wallet)
router.post('/', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;

    const guarantorIds = await validateLoanRules(conn, d.member_id, d.principal_amount, d.guarantor_ids);

    const [wallet] = await conn.query('SELECT balance FROM wallets WHERE id = ?', [d.disbursement_wallet_id]);
    if (wallet.length === 0) throw Object.assign(new Error('Disbursement wallet not found'), { statusCode: 404 });
    if (Number(wallet[0].balance) < d.principal_amount) throw Object.assign(new Error('Insufficient funds to disburse this loan'), { statusCode: 400 });

    const [result] = await conn.query(
      `INSERT INTO loans (member_id, principal_amount, principal_owed, interest_owed, fines_owed, purpose, date_issued, status, is_migrated, last_accrual_date, disbursement_wallet_id)
       VALUES (?, ?, ?, 0, 0, ?, ?, 'Active', 0, ?, ?)`,
      [d.member_id, d.principal_amount, d.principal_amount, d.purpose || null, d.date_issued, d.date_issued, d.disbursement_wallet_id]
    );
    const loanId = result.insertId;

    for (const gid of guarantorIds) {
      await conn.query('INSERT INTO loan_guarantors (loan_id, member_id) VALUES (?, ?)', [loanId, gid]);
    }

    await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [d.principal_amount, d.disbursement_wallet_id]);

    await conn.commit();
    res.json({ success: true, id: loanId });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

// POST /api/v1/loans/migrate — enter an existing active loan (Migration Mode only).
// Records the loan's current position without touching wallets or ledgers.
router.post('/migrate', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const d = req.body;

    if (!(await isMigrationMode(conn))) {
      throw Object.assign(new Error('Existing loans can only be entered while the system is in Migration Mode'), { statusCode: 400 });
    }
    if (!d.member_id || !d.principal_owed || Number(d.principal_owed) <= 0) {
      throw Object.assign(new Error('Borrower and remaining principal are required'), { statusCode: 400 });
    }

    const [activeLoan] = await conn.query(
      "SELECT COUNT(*) as count FROM loans WHERE member_id = ? AND status IN ('Active', 'Overdue')",
      [d.member_id]
    );
    if (Number(activeLoan[0].count) > 0) {
      throw Object.assign(new Error('This member already has an active loan in the system'), { statusCode: 400 });
    }

    // Future accrual starts from today's position — history stays on paper
    const [result] = await conn.query(
      `INSERT INTO loans (member_id, principal_amount, principal_owed, interest_owed, fines_owed, purpose, date_issued, status, is_migrated, last_accrual_date, disbursement_wallet_id)
       VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), 'Active', 1, CURDATE(), NULL)`,
      [
        d.member_id,
        d.principal_amount || d.principal_owed,
        d.principal_owed,
        d.interest_owed || 0,
        d.fines_owed || 0,
        d.purpose || 'Migrated from paper records',
        d.date_issued || null
      ]
    );
    const loanId = result.insertId;

    if (d.guarantor_ids && d.guarantor_ids.length > 0) {
      for (const gid of d.guarantor_ids) {
        await conn.query('INSERT INTO loan_guarantors (loan_id, member_id) VALUES (?, ?)', [loanId, gid]);
      }
    }

    await conn.commit();
    res.json({ success: true, id: loanId });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

// POST /api/v1/loans/:id/repay — repayment waterfall: fines → interest → principal.
// Interest & fine portions auto-generate Income Ledger entries; principal never does.
router.post('/:id/repay', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const loanId = parseInt(req.params.id);
    const { amount, wallet_id, payment_method, date, notes } = req.body;

    if (!amount || Number(amount) <= 0) throw Object.assign(new Error('Repayment amount must be greater than zero'), { statusCode: 400 });
    if (!wallet_id) throw Object.assign(new Error('A wallet must be selected to receive the repayment'), { statusCode: 400 });

    const [walletRows] = await conn.query('SELECT id, is_active FROM wallets WHERE id = ?', [wallet_id]);
    if (walletRows.length === 0) throw Object.assign(new Error('Wallet not found'), { statusCode: 404 });
    if (!Number(walletRows[0].is_active)) throw Object.assign(new Error('Cannot receive payments into an inactive wallet'), { statusCode: 400 });

    // Bring the loan fully up to date before applying the payment
    const { interestRate, fineRate } = await getRates(conn);
    const loan = await accrueLoan(conn, loanId, interestRate, fineRate);
    if (!loan) throw Object.assign(new Error('Loan not found'), { statusCode: 404 });
    if (loan.status !== 'Active' && loan.status !== 'Overdue') {
      throw Object.assign(new Error(`Cannot record a repayment on a ${loan.status} loan`), { statusCode: 400 });
    }

    const totalOwed = loan.principal_owed + loan.interest_owed + loan.fines_owed;
    const payment = Math.round(Number(amount));
    if (payment > totalOwed) {
      throw Object.assign(new Error(`Payment exceeds the total outstanding balance (${totalOwed / 100})`), { statusCode: 400 });
    }

    // Waterfall allocation
    let remaining = payment;
    const finesPaid = Math.min(remaining, loan.fines_owed);
    remaining -= finesPaid;
    const interestPaid = Math.min(remaining, loan.interest_owed);
    remaining -= interestPaid;
    const principalPaid = Math.min(remaining, loan.principal_owed);

    const newPrincipal = loan.principal_owed - principalPaid;
    const newInterest = loan.interest_owed - interestPaid;
    const newFines = loan.fines_owed - finesPaid;
    const newStatus = (newPrincipal === 0 && newInterest === 0 && newFines === 0)
      ? 'Paid'
      : (newFines > 0 ? 'Overdue' : 'Active');

    await conn.query(
      'UPDATE loans SET principal_owed = ?, interest_owed = ?, fines_owed = ?, status = ? WHERE id = ?',
      [newPrincipal, newInterest, newFines, newStatus, loanId]
    );

    const [memberRows] = await conn.query('SELECT member_id FROM loans WHERE id = ?', [loanId]);
    const memberId = memberRows[0].member_id;
    const paymentDate = date || new Date().toISOString().split('T')[0];

    // Auto-generated income entries — interest and fines only, never principal
    let interestLedgerId = null;
    if (interestPaid > 0) {
      const typeId = await getIncomeTypeIdByCode(conn, 'loan_interest');
      const [r] = await conn.query(
        `INSERT INTO income_ledger (date, payer_type, member_id, income_type_id, amount, interest_part, payment_method, wallet_id, loan_id, notes, status)
         VALUES (?, 'Member', ?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
        [paymentDate, memberId, typeId, interestPaid, interestPaid, payment_method || 'Cash', wallet_id, loanId, notes || 'Loan interest payment']
      );
      interestLedgerId = r.insertId;
    }
    if (finesPaid > 0) {
      const typeId = await getIncomeTypeIdByCode(conn, 'loan_fine');
      await conn.query(
        `INSERT INTO income_ledger (date, payer_type, member_id, income_type_id, amount, payment_method, wallet_id, loan_id, notes, status)
         VALUES (?, 'Member', ?, ?, ?, ?, ?, ?, ?, 'Active')`,
        [paymentDate, memberId, typeId, finesPaid, payment_method || 'Cash', wallet_id, loanId, notes || 'Loan late-payment fine']
      );
    }

    await conn.query(
      `INSERT INTO loan_payments (loan_id, date, principal_paid, interest_paid, fines_paid, wallet_id, income_ledger_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [loanId, paymentDate, principalPaid, interestPaid, finesPaid, wallet_id, interestLedgerId]
    );

    // The full payment (principal included) lands in the wallet as cash
    await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [payment, wallet_id]);

    await conn.commit();
    res.json({
      success: true,
      allocation: { fines_paid: finesPaid, interest_paid: interestPaid, principal_paid: principalPaid },
      status: newStatus
    });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

// GET /api/v1/loans/:id — full loan detail: borrower, guarantors, payment history
router.get('/:id(\\d+)', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    const id = parseInt(req.params.id);

    // Bring accruals up to date so the detail view always shows current figures
    await conn.beginTransaction();
    const { interestRate, fineRate } = await getRates(conn);
    await accrueLoan(conn, id, interestRate, fineRate);
    await conn.commit();

    const [loanRows] = await conn.query(`
      SELECT l.*, m.full_name as member_name, m.nic as member_nic, m.phone as member_phone,
             m.society_id as member_society_id, w.name as disbursement_wallet_name
      FROM loans l
      JOIN members m ON l.member_id = m.id
      LEFT JOIN wallets w ON l.disbursement_wallet_id = w.id
      WHERE l.id = ?
    `, [id]);
    if (loanRows.length === 0) throw Object.assign(new Error('Loan not found'), { statusCode: 404 });

    const [guarantors] = await conn.query(`
      SELECT m.id, m.full_name, m.nic, m.phone
      FROM loan_guarantors lg JOIN members m ON lg.member_id = m.id
      WHERE lg.loan_id = ?
    `, [id]);

    const [payments] = await conn.query(
      'SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, id DESC',
      [id]
    );

    const l = loanRows[0];
    res.json({
      ...l,
      principal_amount: Number(l.principal_amount),
      principal_owed: Number(l.principal_owed),
      interest_owed: Number(l.interest_owed),
      fines_owed: Number(l.fines_owed),
      is_migrated: Number(l.is_migrated),
      guarantors,
      payments: payments.map(p => ({
        ...p,
        principal_paid: Number(p.principal_paid),
        interest_paid: Number(p.interest_paid),
        fines_paid: Number(p.fines_paid)
      }))
    });
  } catch (err) { await conn.rollback().catch(() => {}); next(err); } finally { conn.release(); }
});

// GET /api/v1/loans/:id/payments — repayment history for one loan
router.get('/:id/payments', async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      'SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, id DESC',
      [parseInt(req.params.id)]
    );
    res.json(rows.map(r => ({
      ...r,
      principal_paid: Number(r.principal_paid),
      interest_paid: Number(r.interest_paid),
      fines_paid: Number(r.fines_paid)
    })));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const id = parseInt(req.params.id);

    const [loanRows] = await conn.query('SELECT * FROM loans WHERE id = ?', [id]);
    if (loanRows.length === 0) throw Object.assign(new Error('Loan not found'), { statusCode: 404 });
    const loan = loanRows[0];

    // Reverse every repayment so wallets and the ledger end up exactly as if
    // the loan never existed. Loan-generated ledger rows are always 'Active'
    // (the income module refuses to void them), so their cash is still in the
    // wallet and can be subtracted unconditionally.
    const [ledgerRows] = await conn.query(
      'SELECT id, amount, wallet_id FROM income_ledger WHERE loan_id = ?', [id]
    );
    for (const row of ledgerRows) {
      if (row.wallet_id) {
        await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [Number(row.amount), row.wallet_id]);
      }
    }

    // Principal portions aren't in the ledger — reverse them per payment.
    // Older payments predate the wallet_id column: fall back to the wallet of
    // the payment's linked interest ledger row, then the disbursement wallet.
    const [payments] = await conn.query(
      `SELECT lp.principal_paid, lp.wallet_id, il.wallet_id AS ledger_wallet_id
       FROM loan_payments lp
       LEFT JOIN income_ledger il ON il.id = lp.income_ledger_id
       WHERE lp.loan_id = ?`, [id]
    );
    for (const p of payments) {
      const walletId = p.wallet_id || p.ledger_wallet_id || loan.disbursement_wallet_id;
      if (Number(p.principal_paid) > 0 && walletId) {
        await conn.query('UPDATE wallets SET balance = balance - ? WHERE id = ?', [Number(p.principal_paid), walletId]);
      }
    }

    // loan_payments references income_ledger (income_ledger_id FK) — delete it first
    await conn.query('DELETE FROM loan_payments WHERE loan_id = ?', [id]);
    await conn.query('DELETE FROM income_ledger WHERE loan_id = ?', [id]);

    // Return the disbursed principal to the wallet it was paid out from
    // (migrated loans never took wallet money)
    if (!Number(loan.is_migrated) && loan.disbursement_wallet_id) {
      await conn.query('UPDATE wallets SET balance = balance + ? WHERE id = ?', [Number(loan.principal_amount), loan.disbursement_wallet_id]);
    }

    // Delete guarantors
    await conn.query('DELETE FROM loan_guarantors WHERE loan_id = ?', [id]);

    // Delete loan
    await conn.query('DELETE FROM loans WHERE id = ?', [id]);

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); next(err); } finally { conn.release(); }
});

module.exports = router;
