import { api } from '@/lib/api/client'
import type { IssueLoanPayload, Loan, LoanDetail, LoanPayment, MigrateLoanPayload, RepayPayload, RepayResult } from './types'

export const loansApi = {
  // Listing accrues interest and fines server-side, so it is never refetched
  // on window focus (see queries.ts).
  list: () => api.get<Loan[]>('/loans'),
  get: (id: number) => api.get<LoanDetail>(`/loans/${id}`),
  payments: (id: number) => api.get<LoanPayment[]>(`/loans/${id}/payments`),
  issue: (p: IssueLoanPayload) => api.post<{ success: boolean; id: number }>('/loans', p),
  migrate: (p: MigrateLoanPayload) => api.post<{ success: boolean; id: number }>('/loans/migrate', p),
  repay: (id: number, p: RepayPayload) => api.post<RepayResult>(`/loans/${id}/repay`, p),
  remove: (id: number) => api.delete<{ success: boolean }>(`/loans/${id}`)
}
