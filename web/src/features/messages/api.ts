import { api } from '@/lib/api/client'
import type { Announcement, AnnouncementPayload, MemberRequest, PurukaCategory, PurukaFilters, PurukaPost, RequestStatus } from './types'

function query(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const messagesApi = {
  // Announcements — creating one pushes a notification to every app member,
  // which is why publishing is confirmed rather than instant.
  announcements: () => api.get<Announcement[]>('/announcements'),
  create: (p: AnnouncementPayload) => api.post<{ success: boolean; id: number }>('/announcements', p),
  update: (id: number, p: AnnouncementPayload) => api.put<{ success: boolean }>(`/announcements/${id}`, p),
  toggle: (id: number) => api.patch<{ success: boolean }>(`/announcements/${id}/toggle`),
  remove: (id: number) => api.delete<{ success: boolean }>(`/announcements/${id}`),

  // Member requests
  requests: (status?: string) => api.get<MemberRequest[]>(`/member-requests${query({ status })}`),
  review: (id: number, body: { status: RequestStatus; staff_note?: string }) => api.patch<{ success: boolean }>(`/member-requests/${id}`, body),

  // Puruka moderation
  posts: (f: PurukaFilters) => api.get<PurukaPost[]>(`/puruka-admin${query({ ...f })}`),
  takeDown: (id: number) => api.patch<{ success: boolean }>(`/puruka-admin/${id}/deactivate`),
  restore: (id: number) => api.patch<{ success: boolean }>(`/puruka-admin/${id}/reactivate`),
  categories: () => api.get<PurukaCategory[]>('/puruka-admin/categories'),
  createCategory: (b: { code: string; label_en: string; label_si: string }) => api.post<{ success: boolean; id: number }>('/puruka-admin/categories', b),
  updateCategory: (id: number, b: { label_en?: string; label_si?: string; is_active?: boolean }) => api.patch<{ success: boolean }>(`/puruka-admin/categories/${id}`, b)
}
