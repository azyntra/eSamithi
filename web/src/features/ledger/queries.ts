import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { expenseApi, incomeApi, ledgerApiFor, type LedgerParams } from './api'
import type { ExpensePayload, ExpenseTransaction, IncomePayload, IncomeTransaction, LedgerKind, LedgerPageData } from './types'

const keyFor = (kind: LedgerKind, params?: LedgerParams) => (kind === 'income' ? qk.income(params) : qk.expenses(params))

export function useLedger(kind: LedgerKind, params: LedgerParams) {
  return useQuery({
    queryKey: keyFor(kind, { search: params.search ?? '', type_id: params.type_id ?? 0, from: params.from ?? '', to: params.to ?? '', page: params.page ?? 1, limit: params.limit ?? 25 }),
    queryFn: () => ledgerApiFor(kind).list(params) as Promise<LedgerPageData<IncomeTransaction | ExpenseTransaction>>,
    placeholderData: keepPreviousData,
    staleTime: 30_000
  })
}

// Money moved: ledger, dashboard, wallets and every member statement are stale
function useInvalidateLedger(kind: LedgerKind) {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: keyFor(kind) }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
      qc.invalidateQueries({ queryKey: qk.wallets }),
      qc.invalidateQueries({ queryKey: ['member-statement'] })
    ])
}

export function useCreateIncome() {
  const invalidate = useInvalidateLedger('income')
  return useMutation({ mutationFn: (p: IncomePayload) => incomeApi.create(p), onSuccess: () => invalidate() })
}
export function useCreateExpense() {
  const invalidate = useInvalidateLedger('expenses')
  return useMutation({ mutationFn: (p: ExpensePayload) => expenseApi.create(p), onSuccess: () => invalidate() })
}
export function useVoidTx(kind: LedgerKind) {
  const invalidate = useInvalidateLedger(kind)
  return useMutation({ mutationFn: ({ id, reason }: { id: number; reason: string }) => ledgerApiFor(kind).void(id, reason), onSuccess: () => invalidate() })
}
export function useDeleteTx(kind: LedgerKind) {
  const invalidate = useInvalidateLedger(kind)
  return useMutation({ mutationFn: (id: number) => ledgerApiFor(kind).remove(id), onSuccess: () => invalidate() })
}
