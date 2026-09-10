import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { loansApi } from './api'
import type { IssueLoanPayload, MigrateLoanPayload, RepayPayload } from './types'

// GET /loans runs the accrual engine and writes, so it must not be refetched
// on every window focus (requirements §6.8).
export function useLoans() {
  return useQuery({ queryKey: qk.loans, queryFn: loansApi.list, staleTime: 60_000, refetchOnWindowFocus: false })
}
export function useLoan(id: number, enabled = true) {
  return useQuery({ queryKey: qk.loan(id), queryFn: () => loansApi.get(id), enabled: enabled && Number.isFinite(id) && id > 0, staleTime: 30_000, refetchOnWindowFocus: false })
}

// Loans move wallet money and generate ledger rows
function useInvalidateLoans() {
  const qc = useQueryClient()
  return (id?: number) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.loans }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
      qc.invalidateQueries({ queryKey: qk.wallets }),
      qc.invalidateQueries({ queryKey: qk.income() }),
      qc.invalidateQueries({ queryKey: ['member-statement'] }),
      ...(id ? [qc.invalidateQueries({ queryKey: qk.loan(id) })] : [])
    ])
}

export function useIssueLoan() {
  const invalidate = useInvalidateLoans()
  return useMutation({ mutationFn: (p: IssueLoanPayload) => loansApi.issue(p), onSuccess: () => invalidate() })
}
export function useMigrateLoan() {
  const invalidate = useInvalidateLoans()
  return useMutation({ mutationFn: (p: MigrateLoanPayload) => loansApi.migrate(p), onSuccess: () => invalidate() })
}
export function useRepayLoan(id: number) {
  const invalidate = useInvalidateLoans()
  return useMutation({ mutationFn: (p: RepayPayload) => loansApi.repay(id, p), onSuccess: () => invalidate(id) })
}
export function useDeleteLoan() {
  const qc = useQueryClient()
  const invalidate = useInvalidateLoans()
  return useMutation({
    mutationFn: (id: number) => loansApi.remove(id),
    onSuccess: async (_r, id) => {
      qc.removeQueries({ queryKey: qk.loan(id) })
      await invalidate()
    }
  })
}
