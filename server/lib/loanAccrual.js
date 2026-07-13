const { getSetting } = require('./settings');

// Monthly loan accrual engine — shared by the staff loan routes and the
// member app's /me routes so both always see identical, up-to-date figures.
// (Extracted verbatim from routes/loans.routes.js for the member app.)

// ── Date helpers (pure calendar math, no timezone drift) ─────────
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

function addOneMonth({ y, m, d }) {
  let year = y, month = m + 1;
  if (month > 12) { month = 1; year++; }
  return { y: year, m: month, d: Math.min(d, daysInMonth(year, month)) };
}

function dateLte(a, b) {
  if (a.y !== b.y) return a.y < b.y;
  if (a.m !== b.m) return a.m < b.m;
  return a.d <= b.d;
}

function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return { y, m, d };
}

function toDateStr({ y, m, d }) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayParts() {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

// ── Monthly accrual engine ───────────────────────────────────────
// For every full month elapsed since last_accrual_date:
//   1. Fine the unpaid interest carried from the previous month (late_fine_rate %)
//   2. Add this month's interest on the current remaining principal (monthly_interest_rate %)
// Interest shrinks as the principal is paid down; fines compound only off unpaid interest.
async function accrueLoan(conn, loanId, interestRate, fineRate) {
  const [rows] = await conn.query(
    `SELECT id, principal_owed, interest_owed, fines_owed, status,
            DATE_FORMAT(COALESCE(last_accrual_date, date_issued), '%Y-%m-%d') as accrual_from
     FROM loans WHERE id = ? FOR UPDATE`,
    [loanId]
  );
  if (rows.length === 0) return null;
  const loan = rows[0];
  if (loan.status !== 'Active' && loan.status !== 'Overdue') return loan;

  let principalOwed = Number(loan.principal_owed);
  let interestOwed = Number(loan.interest_owed);
  let finesOwed = Number(loan.fines_owed);

  let cursor = parseDateStr(loan.accrual_from);
  const today = todayParts();
  let changed = false;

  let next = addOneMonth(cursor);
  while (dateLte(next, today)) {
    if (interestOwed > 0 && fineRate > 0) {
      finesOwed += Math.round(interestOwed * (fineRate / 100));
    }
    if (principalOwed > 0 && interestRate > 0) {
      interestOwed += Math.round(principalOwed * (interestRate / 100));
    }
    cursor = next;
    next = addOneMonth(cursor);
    changed = true;
  }

  // A fine only exists when interest went unpaid past a month boundary, so
  // fines_owed > 0 is exactly "behind schedule" — flip to Overdue. A repayment
  // that clears the fines moves it back to Active (handled in the repay route).
  const newStatus = finesOwed > 0 ? 'Overdue' : 'Active';

  if (changed) {
    await conn.query(
      'UPDATE loans SET interest_owed = ?, fines_owed = ?, last_accrual_date = ?, status = ? WHERE id = ?',
      [interestOwed, finesOwed, toDateStr(cursor), newStatus, loanId]
    );
  } else if (newStatus !== loan.status) {
    await conn.query('UPDATE loans SET status = ? WHERE id = ?', [newStatus, loanId]);
  }

  return { ...loan, principal_owed: principalOwed, interest_owed: interestOwed, fines_owed: finesOwed, status: newStatus };
}

async function getRates(runner) {
  const interestRate = parseFloat(await getSetting('monthly_interest_rate', runner)) || 0;
  const fineRate = parseFloat(await getSetting('late_fine_rate', runner)) || 0;
  return { interestRate, fineRate };
}

module.exports = { accrueLoan, getRates };
