import { api } from '@/lib/api/client'
import type { AnnualReport, ArrearsReport, MonthlyReport } from './types'

export const reportsApi = {
  monthly: (year: number, month: number) => api.get<MonthlyReport>('/reports/monthly', { year, month }),
  annual: (year: number) => api.get<AnnualReport>('/reports/annual', { year }),
  arrears: () => api.get<ArrearsReport>('/reports/arrears')
}
