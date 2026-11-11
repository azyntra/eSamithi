import { api } from '@/lib/api/client'
import type { AnnualReport, AppUsageReport, ArrearsReport, MonthlyReport } from './types'

export const reportsApi = {
  monthly: (year: number, month: number) => api.get<MonthlyReport>('/reports/monthly', { year, month }),
  annual: (year: number) => api.get<AnnualReport>('/reports/annual', { year }),
  arrears: () => api.get<ArrearsReport>('/reports/arrears'),
  appUsage: () => api.get<AppUsageReport>('/reports/app-usage')
}
