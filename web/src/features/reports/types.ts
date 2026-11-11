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

export type AppUsageStatus = 'online' | 'active' | 'occasional' | 'dormant' | 'not_enrolled' | 'blocked'
export interface AppUsageMember {
  id: number
  society_id: string
  full_name: string | null
  phone: string | null
  status: AppUsageStatus
  enrolled: boolean
  enrolled_at: string | null
  first_seen_at: string | null
  last_seen_at: string | null
  platform: string | null
  app_version: string | null
  push_enabled: boolean
  pin_locked: boolean
}
export interface AppUsageReport {
  generated_at: string
  thresholds: { online_minutes: number; active_days: number; occasional_days: number }
  counts: Record<AppUsageStatus | 'total' | 'enrolled', number>
  members: AppUsageMember[]
}
