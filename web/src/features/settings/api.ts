import { api } from '@/lib/api/client'

export interface IncomeType {
  id: number
  name: string
  standard_amount: number
  category_group: string
  code: string | null
  is_active: number
}
export interface ExpenseType {
  id: number
  name: string
  standard_payout: number
  code: string | null
  is_active: number
}
export type Settings = Record<string, string>

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  update: (updates: Record<string, string>) => api.put<{ success: boolean }>('/settings', updates),
  incomeTypes: () => api.get<IncomeType[]>('/income-types'),
  expenseTypes: () => api.get<ExpenseType[]>('/expense-types')
}
