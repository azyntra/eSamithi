export type LoanStatus = 'Active' | 'Overdue' | 'Paid' | 'Defaulted'
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Cheque'

export interface Loan {
  id: number
  member_id: number
  principal_amount: number
  principal_owed: number
  interest_owed: number
  fines_owed: number
  purpose: string | null
  date_issued: string
  status: LoanStatus
  is_migrated: number
  last_accrual_date: string | null
  disbursement_wallet_id: number | null
  created_at: string
  member_name?: string | null
  member_nic?: string | null
  member_society_id?: string | null
  disbursement_wallet_name?: string | null
  guarantor_count?: number
}

export interface Guarantor {
  id: number
  full_name: string | null
  nic: string | null
  phone: string | null
}

export interface LoanPayment {
  id: number
  loan_id: number
  date: string
  principal_paid: number
  interest_paid: number
  fines_paid: number
  bill_no?: string | null
  wallet_id: number | null
  income_ledger_id: number | null
}

export interface LoanDetail extends Loan {
  member_phone?: string | null
  guarantors: Guarantor[]
  payments: LoanPayment[]
}

export interface IssueLoanPayload {
  member_id: number
  principal_amount: number
  purpose: string
  date_issued: string
  disbursement_wallet_id: number
  guarantor_ids: number[]
}

export interface MigrateLoanPayload {
  member_id: number
  principal_amount: number
  principal_owed: number
  interest_owed: number
  fines_owed: number
  date_issued: string | null
  as_of_date: string | null
  status?: 'Defaulted'
  guarantor_ids: number[]
  purpose: string | null
}

export interface RepayPayload {
  amount: number
  wallet_id: number
  payment_method: PaymentMethod
  date: string
  bill_no: string | null
  notes: string | null
}

export interface RepayResult {
  success: boolean
  allocation: { fines_paid: number; interest_paid: number; principal_paid: number }
  status: LoanStatus
}

export const isOpen = (l: Pick<Loan, 'status'>): boolean => l.status === 'Active' || l.status === 'Overdue'
export const balanceOf = (l: Pick<Loan, 'principal_owed' | 'interest_owed' | 'fines_owed'>): number => l.principal_owed + l.interest_owed + l.fines_owed

// The server's rule, mirrored exactly: the limit caps a member's TOTAL
// outstanding PRINCIPAL, so interest and fines never consume borrowing room
// and repayments free headroom up again. maxLimit 0 disables the cap.
export function exposureOf(loans: Loan[], memberId: number | null): number {
  if (!memberId) return 0
  return loans.filter((l) => l.member_id === memberId && isOpen(l)).reduce((s, l) => s + l.principal_owed, 0)
}
export function headroomOf(loans: Loan[], memberId: number | null, maxLimit: number): number | null {
  if (maxLimit <= 0) return null
  return maxLimit - exposureOf(loans, memberId)
}

// Interest resumes on the same day-of-month, clamped to short months
export function nextChargePreview(asOfDate: string, principalOwed: number, monthlyRatePct: number): { date: string; amount: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfDate || '')
  if (!m || principalOwed <= 0 || !(monthlyRatePct > 0)) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const nextMonth = mo === 12 ? 1 : mo + 1
  const nextYear = mo === 12 ? y + 1 : y
  const daysInNext = new Date(nextYear, nextMonth, 0).getDate()
  const day = Math.min(d, daysInNext)
  return { date: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`, amount: Math.round(principalOwed * (monthlyRatePct / 100)) }
}
