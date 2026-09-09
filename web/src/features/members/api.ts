import { api } from '@/lib/api/client'
import type { MemberPayload, MemberStatement, MembersPage, MemberWithDependents, SlimMember } from './types'

export interface MembersListParams {
  search?: string
  page?: number
  limit?: number
}

export const membersApi = {
  list: (params: MembersListParams) => api.get<MembersPage>('/members', { search: params.search || undefined, page: params.page ?? 1, limit: params.limit ?? 15 }),
  slim: () => api.get<SlimMember[]>('/members/slim'),
  get: (id: number) => api.get<MemberWithDependents>(`/members/${id}`),
  statement: (id: number) => api.get<MemberStatement>(`/members/${id}/statement`),
  create: (payload: MemberPayload) => api.post<{ success: boolean; id: number }>('/members', payload),
  update: (id: number, payload: MemberPayload) => api.put<{ success: boolean }>(`/members/${id}`, payload),
  remove: (id: number) => api.delete<{ success: boolean }>(`/members/${id}`),
  checkUnique: (field: 'society_id' | 'nic', value: string, excludeId?: number) =>
    api.get<boolean>('/members/check-unique', { field, value, excludeId }),
  setAppAccess: (id: number, body: { app_enabled?: 0 | 1; reset_pin?: boolean }) => api.put<{ success: boolean }>(`/members/${id}/app-access`, body)
}
