const express = require('express');
const { getPool } = require('../db');
const { memberAuthMiddleware } = require('../middleware/memberAuth');
const { getMemberStatement } = require('../lib/memberQueries');
const { accrueLoan, getRates } = require('../lib/loanAccrual');
const { getSetting, isMigrationMode } = require('../lib/settings');

// Member self-service API for the mobile app. Every query is hard-scoped to
// req.member.id — a member can only ever read their own rows.
const router = express.Router();
router.use(memberAuthMiddleware);

// Only these member columns leave the server (data minimization — PDPA)
const PROFILE_FIELDS = `id, society_id, nic, full_name,
  DATE_FORMAT(date_of_birth, '%Y-%m-%d') as date_of_birth,
  gender, marital_status, occupation, address, phone,
  DATE_FORMAT(date_of_joining, '%Y-%m-%d') as date_of_joining,
  bank_name, bank_account_holder_name, bank_account_number, is_active`;

// GET /api/v1/me/profile
router.get('/profile', async (req, res, next) => {
  try {
    const pool = getPool();
    const [members] = await pool.query(`SELECT ${PROFILE_FIELDS} FROM members WHERE id = ?`, [req.member.id]);
    if (members.length === 0) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const [dependents] = await pool.query(
      `SELECT name, relationship, DATE_FORMAT(date_of_birth, '%Y-%m-%d') as date_of_birth, age
       FROM dependents WHERE member_id = ?`,
      [req.member.id]
    );
    res.json({ ...members[0], is_active: members[0].is_active === null ? 1 : Number(members[0].is_active), dependents });
  } catch (err) { next(err); }
});

// GET /api/v1/me/statement — contributions, payouts, loans, guarantees.
// Accrue this member's running loans first so the balances match what the
// office sees — noticeable once a member holds more than one loan.
router.get('/statement', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const { interestRate, fineRate } = await getRates(conn);
    const [running] = await conn.query(
      "SELECT id FROM loans WHERE member_id = ? AND status IN ('Active', 'Overdue')",
      [req.member.id]
    );
    for (const l of running) {
      await accrueLoan(conn, l.id, interestRate, fineRate);
    }
    await conn.commit();
    res.json(await getMemberStatement(getPool(), req.member.id));
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/v1/me/dues — "do I owe anything?" summary
router.get('/dues', async (req, res, next) => {
  try {
    const pool = getPool();

    const [overdue] = await pool.query(
      `SELECT id, principal_owed, interest_owed, fines_owed FROM loans
       WHERE member_id = ? AND status = 'Overdue'`,
      [req.member.id]
    );

    // Membership-fee arrears only make sense once live — mirrors reports.routes.js
    let membershipFeePaid = null;
    if (!(await isMigrationMode(pool))) {
      const [feeRows] = await pool.query(
        `SELECT COUNT(*) as count FROM income_ledger il
         JOIN income_types it ON it.id = il.income_type_id
         WHERE il.member_id = ? AND il.status = 'Active' AND it.code = 'membership_fee'`,
        [req.member.id]
      );
      membershipFeePaid = Number(feeRows[0].count) > 0;
    }

    res.json({
      overdue_loans: overdue.map(l => ({
        id: l.id,
        principal_owed: Number(l.principal_owed),
        interest_owed: Number(l.interest_owed),
        fines_owed: Number(l.fines_owed)
      })),
      membership_fee_paid: membershipFeePaid
    });
  } catch (err) { next(err); }
});

// GET /api/v1/me/receipts/:kind/:id — one transaction in receipt detail, so the
// app can show the member the same document the office prints. Structured data
// rather than rendered HTML: the app owns the wording and the language, and the
// same payload can feed a PDF later.
// Ownership is checked in the WHERE clause — another member's id is a plain 404.
const RECEIPT_KINDS = ['income', 'expense', 'loan-payment'];

router.get('/receipts/:kind/:id(\\d+)', async (req, res, next) => {
  try {
    const { kind } = req.params;
    if (!RECEIPT_KINDS.includes(kind)) {
      throw Object.assign(new Error('Unknown receipt type'), { statusCode: 404 });
    }
    const id = parseInt(req.params.id);
    const pool = getPool();

    // Header block — same whitelist the society-info screen uses
    const [settingsRows] = await pool.query(
      "SELECT `key`, `value` FROM settings WHERE `key` IN ('society_name','society_phone','society_address')"
    );
    const society = {};
    for (const s of settingsRows) society[s.key] = s.value;

    const [[member]] = await pool.query(
      'SELECT full_name, nic, society_id FROM members WHERE id = ?',
      [req.member.id]
    );

    let receipt = null;

    if (kind === 'income') {
      const [[row]] = await pool.query(
        `SELECT i.id, DATE_FORMAT(i.date, '%Y-%m-%d') as date, i.amount, i.status, i.payment_method,
                i.months_covered, i.notes, i.principal_part, i.interest_part, i.loan_id,
                t.name as type_name, t.code as type_code, w.name as wallet_name
         FROM income_ledger i
         JOIN income_types t ON t.id = i.income_type_id
         LEFT JOIN wallets w ON w.id = i.wallet_id
         WHERE i.id = ? AND i.member_id = ?`,
        [id, req.member.id]
      );
      if (row) {
        receipt = {
          receipt_no: `INC-${String(row.id).padStart(5, '0')}`,
          date: row.date,
          amount: Number(row.amount),
          status: row.status,
          payment_method: row.payment_method,
          type_name: row.type_name,
          type_code: row.type_code,
          wallet_name: row.wallet_name,
          months_covered: row.months_covered,
          notes: row.notes,
          principal_part: row.principal_part === null ? null : Number(row.principal_part),
          interest_part: row.interest_part === null ? null : Number(row.interest_part),
          loan_id: row.loan_id
        };
      }
    } else if (kind === 'expense') {
      const [[row]] = await pool.query(
        `SELECT e.id, DATE_FORMAT(e.date, '%Y-%m-%d') as date, e.amount, e.status, e.payment_method,
                e.voucher_no, e.notes, e.death_reference,
                t.name as type_name, t.code as type_code, w.name as wallet_name
         FROM expense_ledger e
         JOIN expense_types t ON t.id = e.expense_type_id
         LEFT JOIN wallets w ON w.id = e.wallet_id
         WHERE e.id = ? AND e.member_id = ?`,
        [id, req.member.id]
      );
      if (row) {
        receipt = {
          receipt_no: row.voucher_no || `EXP-${String(row.id).padStart(5, '0')}`,
          date: row.date,
          amount: Number(row.amount),
          status: row.status,
          payment_method: row.payment_method,
          type_name: row.type_name,
          type_code: row.type_code,
          wallet_name: row.wallet_name,
          notes: row.notes,
          death_reference: row.death_reference
        };
      }
    } else {
      // Loan repayment — ownership rides on the parent loan
      const [[row]] = await pool.query(
        `SELECT lp.id, lp.loan_id, DATE_FORMAT(lp.date, '%Y-%m-%d') as date,
                lp.principal_paid, lp.interest_paid, lp.fines_paid, w.name as wallet_name
         FROM loan_payments lp
         JOIN loans l ON l.id = lp.loan_id
         LEFT JOIN wallets w ON w.id = lp.wallet_id
         WHERE lp.id = ? AND l.member_id = ?`,
        [id, req.member.id]
      );
      if (row) {
        const principal = Number(row.principal_paid);
        const interest = Number(row.interest_paid);
        const fines = Number(row.fines_paid);
        receipt = {
          receipt_no: `LNP-${String(row.id).padStart(5, '0')}`,
          date: row.date,
          amount: principal + interest + fines,
          status: 'Active',
          loan_id: row.loan_id,
          principal_paid: principal,
          interest_paid: interest,
          fines_paid: fines,
          wallet_name: row.wallet_name
        };
      }
    }

    if (!receipt) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });

    res.json({
      kind,
      society: {
        name: society.society_name || null,
        phone: society.society_phone || null,
        address: society.society_address || null
      },
      member: {
        full_name: member ? member.full_name : null,
        nic: member ? member.nic : null,
        society_id: member ? member.society_id : null
      },
      ...receipt
    });
  } catch (err) { next(err); }
});

// GET /api/v1/me/loans/:id — own loan only; accrues first so figures are current
router.get('/loans/:id(\\d+)', async (req, res, next) => {
  const conn = await getPool().getConnection();
  try {
    const id = parseInt(req.params.id);

    // Ownership before anything else — a foreign id is a plain 404
    const [ownRows] = await conn.query('SELECT member_id FROM loans WHERE id = ?', [id]);
    if (ownRows.length === 0 || Number(ownRows[0].member_id) !== Number(req.member.id)) {
      throw Object.assign(new Error('Loan not found'), { statusCode: 404 });
    }

    await conn.beginTransaction();
    const { interestRate, fineRate } = await getRates(conn);
    await accrueLoan(conn, id, interestRate, fineRate);
    await conn.commit();

    const [loanRows] = await conn.query(
      `SELECT l.id, l.principal_amount, l.principal_owed, l.interest_owed, l.fines_owed,
              l.purpose, DATE_FORMAT(l.date_issued, '%Y-%m-%d') as date_issued, l.status, l.is_migrated
       FROM loans l WHERE l.id = ?`,
      [id]
    );

    // Guarantor names only — no NIC/phone of other members to the app
    const [guarantors] = await conn.query(
      `SELECT m.full_name FROM loan_guarantors lg JOIN members m ON lg.member_id = m.id WHERE lg.loan_id = ?`,
      [id]
    );

    const [payments] = await conn.query(
      `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') as date, principal_paid, interest_paid, fines_paid
       FROM loan_payments WHERE loan_id = ? ORDER BY date DESC, id DESC`,
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
      guarantors: guarantors.map(g => g.full_name),
      payments: payments.map(p => ({
        ...p,
        principal_paid: Number(p.principal_paid),
        interest_paid: Number(p.interest_paid),
        fines_paid: Number(p.fines_paid)
      }))
    });
  } catch (err) { await conn.rollback().catch(() => {}); next(err); } finally { conn.release(); }
});

// GET /api/v1/me/benefits-schedule — what the society pays, per benefit type
router.get('/benefits-schedule', async (_req, res, next) => {
  try {
    // Operational categories are society bookkeeping, not member entitlements
    const [rows] = await getPool().query(
      `SELECT name, code, standard_payout FROM expense_types
       WHERE is_active = 1 AND (code IS NULL OR code NOT IN ('bills_operational', 'other_expense'))
       ORDER BY standard_payout DESC, name ASC`
    );
    res.json(rows.map(r => ({ ...r, standard_payout: Number(r.standard_payout) })));
  } catch (err) { next(err); }
});

// GET /api/v1/me/announcements — active notices, newest first
router.get('/announcements', async (_req, res, next) => {
  try {
    const [rows] = await getPool().query(`
      SELECT id, type, title, body, deceased_name,
             DATE_FORMAT(funeral_date, '%Y-%m-%d') as funeral_date, funeral_location,
             DATE_FORMAT(event_date, '%Y-%m-%d') as event_date,
             DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
      FROM announcements WHERE is_active = 1
      ORDER BY created_at DESC, id DESC LIMIT 50
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /api/v1/me/push-token — register/refresh this device's Expo push token
router.post('/push-token', async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    if (!token || typeof token !== 'string' || token.length > 255) {
      return res.status(400).json({ error: 'Invalid push token' });
    }
    await getPool().query(
      `INSERT INTO member_push_tokens (member_id, token, platform) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE member_id = VALUES(member_id), platform = VALUES(platform)`,
      [req.member.id, token, platform || null]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /api/v1/me/requests — the member's own requests
router.get('/requests', async (req, res, next) => {
  try {
    const [rows] = await getPool().query(
      `SELECT id, type, amount, purpose, message, status, staff_note,
              DATE_FORMAT(created_at, '%Y-%m-%d') as created_at
       FROM member_requests WHERE member_id = ? ORDER BY created_at DESC, id DESC`,
      [req.member.id]
    );
    res.json(rows.map(r => ({ ...r, amount: r.amount === null ? null : Number(r.amount) })));
  } catch (err) { next(err); }
});

// POST /api/v1/me/requests — submit a loan or correction request
router.post('/requests', async (req, res, next) => {
  try {
    const { type, amount, purpose, message } = req.body;
    const pool = getPool();

    if (!['loan', 'correction'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }
    if (type === 'loan') {
      const cents = Math.round(Number(amount));
      if (!Number.isFinite(cents) || cents <= 0) return res.status(400).json({ error: 'A valid loan amount is required' });
      if (!purpose || !String(purpose).trim()) return res.status(400).json({ error: 'The loan purpose is required' });
      // Same headroom rule the desktop enforces at issuance: outstanding
      // principal across all active loans may not exceed max_loan_limit.
      // Additional loans within the limit are fine; a limit of 0 disables it.
      const maxLimit = Number(await getSetting('max_loan_limit')) || 0;
      if (maxLimit > 0) {
        const [[exp]] = await pool.query(
          `SELECT COALESCE(SUM(principal_owed), 0) AS exposure
           FROM loans WHERE member_id = ? AND status IN ('Active', 'Overdue')`,
          [req.member.id]
        );
        const exposure = Number(exp.exposure);
        const headroom = maxLimit - exposure;
        if (cents > headroom) {
          return res.status(400).json({ error:
            `Your outstanding loans total Rs. ${exposure / 100}. You can request up to ` +
            `Rs. ${Math.max(headroom, 0) / 100} under the society's Rs. ${maxLimit / 100} loan limit.` });
        }
      }
    }
    if (type === 'correction' && (!message || !String(message).trim())) {
      return res.status(400).json({ error: 'Please describe what needs to be corrected' });
    }

    // Keep the queue sane: max 3 pending requests per member
    const [pending] = await pool.query(
      "SELECT COUNT(*) as count FROM member_requests WHERE member_id = ? AND status = 'Pending'",
      [req.member.id]
    );
    if (Number(pending[0].count) >= 3) {
      return res.status(400).json({ error: 'You already have 3 pending requests. Please wait for the office to review them.' });
    }

    const [result] = await pool.query(
      `INSERT INTO member_requests (member_id, type, amount, purpose, message) VALUES (?, ?, ?, ?, ?)`,
      [
        req.member.id, type,
        type === 'loan' ? Math.round(Number(amount)) : null,
        type === 'loan' ? String(purpose).trim() : null,
        message ? String(message).trim() : null
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// GET /api/v1/me/society-info — whitelisted settings only, never the full table
router.get('/society-info', async (_req, res, next) => {
  try {
    const pool = getPool();
    const keys = ['society_name', 'monthly_interest_rate', 'late_fine_rate', 'required_guarantors', 'max_loan_limit', 'society_phone', 'society_address'];
    const info = {};
    for (const key of keys) {
      info[key] = await getSetting(key, pool);
    }
    res.json(info);
  } catch (err) { next(err); }
});

// GET /api/v1/me/society-funds — society financial transparency for members:
// headline funds + cash total + itemized active fixed deposits. Deliberately
// scoped to a funds summary (no physical assets, loans, or member-count data).
router.get('/society-funds', async (_req, res, next) => {
  try {
    const pool = getPool();
    const [[cash]] = await pool.query(
      "SELECT IFNULL(SUM(balance), 0) AS total FROM wallets WHERE is_active = 1"
    );
    const [[fd]] = await pool.query(
      "SELECT IFNULL(SUM(principal), 0) AS total FROM fixed_deposits WHERE status = 'Active'"
    );
    const [deposits] = await pool.query(`
      SELECT id, bank_name, fd_number, principal, interest_rate, maturity_date
      FROM fixed_deposits
      WHERE status = 'Active'
      ORDER BY maturity_date ASC, id ASC
    `);
    const cashTotal = Number(cash.total);
    const fdTotal = Number(fd.total);
    res.json({
      total_funds: cashTotal + fdTotal,
      cash_total: cashTotal,
      fd_total: fdTotal,
      fixed_deposits: deposits.map((d) => ({
        id: d.id,
        bank_name: d.bank_name,
        fd_number: d.fd_number,
        principal: Number(d.principal),
        interest_rate: d.interest_rate === null ? null : Number(d.interest_rate),
        maturity_date: d.maturity_date
      }))
    });
  } catch (err) { next(err); }
});

module.exports = router;
