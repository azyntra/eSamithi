import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { settingsApi } from './api'

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
