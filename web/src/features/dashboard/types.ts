// Mirrors GET /dashboard/stats (server/routes/dashboard.routes.js); money in cents
export interface DashboardStats {
  totalMembers: number
  totalLiquid: number
  totalFDs: number
  totalLoansOwed: number
  activeLoansCount?: number
  attention?: {
    overdueLoans: number
    fdsMaturingSoon: number
    membersWithoutFee: number | null
  }
  chartData: {
    income: Array<{ month: string; total: number }>
    expenses: Array<{ month: string; total: number }>
  }
  recentActivity: Array<{
    type: 'Income' | 'Expense'
    amount: number
    date: string
    name: string | null
  }>
}
