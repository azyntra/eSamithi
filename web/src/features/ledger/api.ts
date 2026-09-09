import { api } from '@/lib/api/client'
import type { ExpensePayload, ExpenseTransaction, IncomePayload, IncomeTransaction, LedgerKind, LedgerPageData } from './types'

export interface LedgerParams {
  search?: string
  type_id?: number
  from?: string
  to?: string
  page?: number
  limit?: number
}

function build<T, P>(kind: LedgerKind) {
  const base = `/${kind}`
  const query = (p: LedgerParams, paginated: boolean) => ({
    search: p.search?.trim() || undefined,
    type_id: p.type_id || undefined,
    from: p.from || undefined,
    to: p.to || undefined,
    ...(paginated ? { page: p.page ?? 1, limit: p.limit ?? 25 } : {})
  })
  return {
    list: (p: LedgerParams) => api.get<LedgerPageData<T>>(base, query(p, true)),
    all: (p: LedgerParams) => api.get<LedgerPageData<T>>(base, query(p, false)),
    create: (payload: P) => api.post<{ success: boolean; id: number }>(base, payload),
    void: (id: number, reason: string) => api.patch<{ success: boolean }>(`${base}/${id}/void`, { reason }),
    remove: (id: number) => api.delete<{ success: boolean }>(`${base}/${id}`)
  }
}

export const incomeApi = build<IncomeTransaction, IncomePayload>('income')
export const expenseApi = build<ExpenseTransaction, ExpensePayload>('expenses')
export const ledgerApiFor = (kind: LedgerKind) => (kind === 'income' ? incomeApi : expenseApi)
