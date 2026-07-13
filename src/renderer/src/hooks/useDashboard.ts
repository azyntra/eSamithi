import { useState, useEffect, useCallback } from 'react'
import { registerCache } from '../utils/cache'

export interface DashboardStats {
  totalMembers: number
  totalLiquid: number
  totalFDs: number
  totalLoansOwed: number
  // Optional: only present once the server is redeployed with the count
  activeLoansCount?: number
  // Optional: only present once the server is redeployed with the attention block
  attention?: {
    overdueLoans: number
    fdsMaturingSoon: number
    // null while in Migration Mode (fee history was never entered)
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
    name: string
  }>
}

let dashboardCache: DashboardStats | null = null
let dashboardCacheTime = 0
const CACHE_TTL = 1000 * 60 * 5 // 5 minutes

registerCache(() => { dashboardCache = null; dashboardCacheTime = 0 }, 'dashboard')

export function useDashboard(): { stats: DashboardStats | null; loading: boolean; error: string | null; fetchData: (force?: boolean) => Promise<void> } {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (forceRefresh = false): Promise<void> => {
    if (!forceRefresh && dashboardCache && Date.now() - dashboardCacheTime < CACHE_TTL) {
      setStats(dashboardCache)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await window.api.dashboard.getStats()
      dashboardCache = data
      dashboardCacheTime = Date.now()
      setStats(data)
      setError(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { stats, loading, error, fetchData }
}
