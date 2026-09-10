import { api } from '@/lib/api/client'
import type { Role } from '@/lib/api/session'

export interface StaffSession {
  id: string
  client: string
  ip: string | null
  user_agent: string | null
  created_at: string
  last_used_at: string
  expires_at: string
  absolute_expires_at: string
  current: boolean
}

export interface Me {
  id: number
  username: string
  full_name: string
  role: Role
  must_change_password: boolean
  last_login_at: string | null
  samithi: { slug: string; name: string | null }
  session: StaffSession | null
  support: { actor: string; sid: string; expires_at: string | null } | null
}

export const authApi = {
  me: () => api.get<Me>('/auth/me'),
  sessions: () => api.get<StaffSession[]>('/auth/sessions'),
  revokeSession: (id: string) => api.delete<{ success: boolean }>(`/auth/sessions/${id}`),
  changePassword: (current_password: string, new_password: string) => api.post<{ success: boolean }>('/auth/change-password', { current_password, new_password })
}
