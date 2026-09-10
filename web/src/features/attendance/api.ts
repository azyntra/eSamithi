import { api } from '@/lib/api/client'
import type { AttendanceMode, CreateEventPayload, EventDetail, MarkResult, SocietyEvent } from './types'

export const attendanceApi = {
  events: () => api.get<SocietyEvent[]>('/events'),
  detail: (id: number) => api.get<EventDetail>(`/events/${id}/attendance`),
  create: (p: CreateEventPayload) => api.post<{ success: boolean; id: number }>('/events', p),
  remove: (id: number) => api.delete<{ success: boolean }>(`/events/${id}`),
  // Switching the method clears every mark server-side: an unmarked member
  // means the opposite thing in each one.
  setMode: (id: number, attendance_mode: AttendanceMode) => api.patch<{ success: boolean; attendance_mode: AttendanceMode; cleared: number }>(`/events/${id}`, { attendance_mode }),
  // A scan sends the society ID off the card; picking a name off the derived
  // list sends the member id (an absentee is not there to scan their card).
  markByCard: (id: number, society_id: string) => api.post<MarkResult>(`/events/${id}/attendance`, { society_id }),
  markByMember: (id: number, member_id: number) => api.post<MarkResult>(`/events/${id}/attendance`, { member_id }),
  unmark: (id: number, memberId: number) => api.delete<{ success: boolean }>(`/events/${id}/attendance/${memberId}`)
}
