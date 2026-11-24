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

export type SocietyPosition = 'secretary' | 'president' | 'treasurer'

export interface SystemUser {
  id: number
  username: string
  full_name: string
  role: 'admin' | 'user' | 'viewer'
  // Society officers (docs/MEETING-MINUTES-REQUIREMENTS.md §3)
  is_active: 0 | 1
  society_position: SocietyPosition | null
  member_id: number | null
  member_name: string | null
  member_society_id: string | null
  // null = no linked member; 0 = linked but they can't use the app yet
  member_app_ready: 0 | 1 | null
}

export interface CreateUserPayload {
  username: string
  password: string
  full_name: string
  role: SystemUser['role']
  society_position?: SocietyPosition | null
  member_id?: number | null
  replace_secretary?: boolean
}

export interface UpdateUserPayload {
  full_name?: string
  role?: SystemUser['role']
  is_active?: boolean
  society_position?: SocietyPosition | null
  member_id?: number | null
  replace_secretary?: boolean
}

// Who holds the Secretary post when a save would take it (409 SECRETARY_TAKEN)
export interface SecretaryHolder {
  user_id: number
  full_name: string
  username: string
  member_name: string | null
}

export interface OfficerEvent {
  id: number
  field: 'role' | 'is_active' | 'society_position' | 'member_id' | 'deleted'
  before_value: string | null
  after_value: string | null
  by_name: string | null
  created_at: string
  before_member: string | null
  after_member: string | null
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
  createUser: (p: CreateUserPayload) => api.post<{ success: boolean; id: number }>('/users', p),
  updateUser: (id: number, p: UpdateUserPayload) => api.patch<SystemUser>(`/users/${id}`, p),
  userEvents: (id: number) => api.get<OfficerEvent[]>(`/users/${id}/events`),
  deleteUser: (id: number) => api.delete<{ success: boolean }>(`/users/${id}`),
  resetUserPassword: (id: number, new_password: string) => api.patch<{ success: boolean }>(`/users/${id}/password`, { new_password })
}
