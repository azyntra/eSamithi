// Member-scoped queries shared by the staff routes (members.routes.js) and
// the member app's /me routes (me.routes.js), so the two views cannot drift.

// The member's full financial history: contributions, payouts, loans and
// guarantees given. `runner` may be a pool or an open connection.
async function getMemberStatement(runner, memberId) {
  const [income] = await runner.query(`
    SELECT i.id, i.date, i.amount, i.status, i.payment_method, i.loan_id, t.name as type_name, t.code as type_code
    FROM income_ledger i JOIN income_types t ON i.income_type_id = t.id
    WHERE i.member_id = ? ORDER BY i.date DESC, i.id DESC
  `, [memberId]);

  const [expenses] = await runner.query(`
    SELECT e.id, e.date, e.amount, e.status, e.payment_method, t.name as type_name, t.code as type_code
    FROM expense_ledger e JOIN expense_types t ON e.expense_type_id = t.id
    WHERE e.member_id = ? ORDER BY e.date DESC, e.id DESC
  `, [memberId]);

  const [loans] = await runner.query(`
    SELECT id, principal_amount, principal_owed, interest_owed, fines_owed, date_issued, status, is_migrated
    FROM loans WHERE member_id = ? ORDER BY date_issued DESC
  `, [memberId]);

  const [guarantees] = await runner.query(`
    SELECT l.id, l.date_issued, l.status, m.full_name as borrower_name
    FROM loan_guarantors lg
    JOIN loans l ON lg.loan_id = l.id
    JOIN members m ON l.member_id = m.id
    WHERE lg.member_id = ? AND l.status IN ('Active', 'Overdue')
  `, [memberId]);

  return {
    income: income.map(r => ({ ...r, amount: Number(r.amount) })),
    expenses: expenses.map(r => ({ ...r, amount: Number(r.amount) })),
    loans: loans.map(r => ({
      ...r,
      principal_amount: Number(r.principal_amount),
      principal_owed: Number(r.principal_owed),
      interest_owed: Number(r.interest_owed),
      fines_owed: Number(r.fines_owed),
      is_migrated: Number(r.is_migrated)
    })),
    guarantees
  };
}

module.exports = { getMemberStatement };
