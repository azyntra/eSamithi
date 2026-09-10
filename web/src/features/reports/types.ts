export interface CategoryRow {
  name: string
  code: string | null
  entry_count: number
  total: number
}
export interface Summary {
  income: CategoryRow[]
  expenses: CategoryRow[]
  totals: { income: number; expenses: number; net: number }
}
export interface MonthlyReport extends Summary {
  year: number
  month: number
  from: string
  to: string
}
export interface AnnualReport extends Summary {
  year: number
  position: {
    members: number
    walletBalance: number
    fdPrincipal: number
    fdCount: number
    loansOutstanding: number
    activeLoans: number
  }
}
export interface ArrearsReport {
  overdueLoans: Array<{ id: number; principal_owed: number; interest_owed: number; fines_owed: number; date_issued: string; member_name: string; society_id: string; phone: string | null }>
  fdsMaturing: Array<{ id: number; fd_number: string; bank_name: string; principal: number; maturity_date: string }>
  // null in Migration Mode — historical fee payments were never entered
  membersWithoutFee: Array<{ id: number; society_id: string; full_name: string; phone: string | null }> | null
}
