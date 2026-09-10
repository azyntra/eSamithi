import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { settingsApi, type ExpenseTypePayload, type IncomeTypePayload, type SystemUser } from './api'

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: settingsApi.get, staleTime: 5 * 60_000 })
}
export function useIncomeTypes() {
  return useQuery({ queryKey: qk.incomeTypes, queryFn: settingsApi.incomeTypes, staleTime: 5 * 60_000 })
}
export function useExpenseTypes() {
  return useQuery({ queryKey: qk.expenseTypes, queryFn: settingsApi.expenseTypes, staleTime: 5 * 60_000 })
}

// The SERVER rule (settings.migration_completed !== 'true' → migration mode).
// `undefined` while settings are loading so callers can avoid flashing gates.
export function useMigrationMode(): boolean | undefined {
  const settings = useSettings()
  if (!settings.data) return undefined
  return settings.data.migration_completed !== 'true'
}

function useInvalidateSettings() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: qk.settings }), qc.invalidateQueries({ queryKey: qk.incomeTypes }), qc.invalidateQueries({ queryKey: qk.expenseTypes }), qc.invalidateQueries({ queryKey: qk.dashboard })])
}

export function useUpdateSettings() {
  const invalidate = useInvalidateSettings()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: Record<string, string>) => settingsApi.update(updates),
    // Loan rules change what the loan screens compute
    onSuccess: async () => {
      await invalidate()
      await qc.invalidateQueries({ queryKey: qk.loans })
    }
  })
}
export function useSaveIncomeType() {
  const invalidate = useInvalidateSettings()
  return useMutation({ mutationFn: (v: { id?: number; payload: Partial<IncomeTypePayload> }) => (v.id ? settingsApi.updateIncomeType(v.id, v.payload) : settingsApi.createIncomeType(v.payload as IncomeTypePayload)), onSuccess: () => invalidate() })
}
export function useDeleteIncomeType() {
  const invalidate = useInvalidateSettings()
  return useMutation({ mutationFn: (id: number) => settingsApi.deleteIncomeType(id), onSuccess: () => invalidate() })
}
export function useSaveExpenseType() {
  const invalidate = useInvalidateSettings()
  return useMutation({ mutationFn: (v: { id?: number; payload: Partial<ExpenseTypePayload> }) => (v.id ? settingsApi.updateExpenseType(v.id, v.payload) : settingsApi.createExpenseType(v.payload as ExpenseTypePayload)), onSuccess: () => invalidate() })
}
export function useDeleteExpenseType() {
  const invalidate = useInvalidateSettings()
  return useMutation({ mutationFn: (id: number) => settingsApi.deleteExpenseType(id), onSuccess: () => invalidate() })
}

export function useSystemUsers(enabled = true) {
  return useQuery({ queryKey: qk.users, queryFn: settingsApi.users, enabled, staleTime: 30_000 })
}
export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (p: { username: string; password: string; full_name: string; role: SystemUser['role'] }) => settingsApi.createUser(p), onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }) })
}
export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: number) => settingsApi.deleteUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk.users }) })
}
export function useResetUserPassword() {
  return useMutation({ mutationFn: (v: { id: number; password: string }) => settingsApi.resetUserPassword(v.id, v.password) })
}
