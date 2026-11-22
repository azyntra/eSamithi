import type { StatementLoan } from '../api/hooks'

// Repaid fraction of the original principal (0..1); migrated loans may have
// odd principal_amounts, so clamp and guard the division.
export function repaidFraction(loan: Pick<StatementLoan, 'principal_amount' | 'principal_owed'>): number | null {
  if (loan.principal_amount <= 0) return null
  return Math.max(0, Math.min(1, (loan.principal_amount - loan.principal_owed) / loan.principal_amount))
}

// Everything still to pay on a loan: principal + interest + fines (cents)
export function loanOwed(loan: Pick<StatementLoan, 'principal_owed' | 'interest_owed' | 'fines_owed'>): number {
  return loan.principal_owed + loan.interest_owed + loan.fines_owed
}

export const isOpenLoan = (loan: Pick<StatementLoan, 'status'>): boolean => loan.status === 'Active' || loan.status === 'Overdue'
