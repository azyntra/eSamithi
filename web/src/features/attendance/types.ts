// Attendance register. The server keeps only the *marked* members in
// event_attendance; attendance_mode decides whether a mark means "was here"
// or "was not here", and the detail endpoint returns both sides already
// resolved. Rows the mode derives carry marked_at = null, which is also what
// makes a row markable rather than removable.
export type EventType = 'meeting' | 'funeral' | 'other'
export type AttendanceMode = 'present' | 'absent'

export const EVENT_TYPES: EventType[] = ['meeting', 'funeral', 'other']

export interface SocietyEvent {
  id: number
  type: EventType
  title: string
  event_date: string
  attendance_mode: AttendanceMode
  attendee_count: number
  created_by?: number | null
  created_at?: string | null
}

export interface AttendanceRow {
  member_id: number
  society_id: string
  full_name: string | null
  nic?: string | null
  phone: string | null
  marked_at: string | null
}

export interface EventDetail {
  event: SocietyEvent
  present: AttendanceRow[]
  absent: AttendanceRow[]
}

export interface CreateEventPayload {
  type: EventType
  title: string
  event_date: string
  attendance_mode: AttendanceMode
}

export interface MarkResult {
  success: boolean
  member: { id: number; society_id: string; full_name: string; is_active: number }
  already: boolean
}

// Marking someone in 'absent' mode lowers the present count instead of
// raising it — the one sign flip the whole screen turns on.
export function presentDelta(mode: AttendanceMode, marking: boolean): number {
  const raise = mode === 'absent' ? -1 : 1
  return marking ? raise : -raise
}

// Which of the two tabs holds individually-marked members in this mode.
export function isMarkedView(mode: AttendanceMode, view: AttendanceMode): boolean {
  return mode === 'absent' ? view === 'absent' : view === 'present'
}

export function turnoutPct(present: number, total: number): number | null {
  if (total <= 0) return null
  return Math.round((present / total) * 100)
}
