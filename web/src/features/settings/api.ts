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

export interface SystemUser {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'user' | 'viewer'
}

export interface IncomeTypePayload {
  name: string
  standard_amount: number
  category_group?: string
  is_active?: 0 | 1
}
export interface ExpenseTypePayload {
  name: string
  standard_payout: number
  is_active?: 0 | 1
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  update: (updates: Record<string, string>) => api.put<{ success: boolean }>('/settings', updates),

  incomeTypes: () => api.get<IncomeType[]>('/income-types'),
  createIncomeType: (p: IncomeTypePayload) => api.post<{ success: boolean; id: number }>('/income-types', p),
  updateIncomeType: (id: number, p: Partial<IncomeTypePayload>) => api.put<{ success: boolean }>(`/income-types/${id}`, p),
  deleteIncomeType: (id: number) => api.delete<{ success: boolean; deactivated?: boolean }>(`/income-types/${id}`),

  expenseTypes: () => api.get<ExpenseType[]>('/expense-types'),
  createExpenseType: (p: ExpenseTypePayload) => api.post<{ success: boolean; id: number }>('/expense-types', p),
  updateExpenseType: (id: number, p: Partial<ExpenseTypePayload>) => api.put<{ success: boolean }>(`/expense-types/${id}`, p),
  deleteExpenseType: (id: number) => api.delete<{ success: boolean; deactivated?: boolean }>(`/expense-types/${id}`),

  users: () => api.get<SystemUser[]>('/users'),
  createUser: (p: { username: string; password: string; full_name: string; role: SystemUser['role'] }) => api.post<{ success: boolean; id: number }>('/users', p),
  deleteUser: (id: number) => api.delete<{ success: boolean }>(`/users/${id}`),
  resetUserPassword: (id: number, new_password: string) => api.patch<{ success: boolean }>(`/users/${id}/password`, { new_password })
}
