import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/queryKeys'
import { attendanceApi } from './api'
import { presentDelta, type AttendanceMode, type AttendanceRow, type CreateEventPayload, type EventDetail, type SocietyEvent } from './types'

export function useEvents() {
  return useQuery({ queryKey: qk.events, queryFn: attendanceApi.events, staleTime: 30_000 })
}

export function useEventDetail(id: number | null) {
  return useQuery({
    queryKey: qk.eventAttendance(id ?? 0),
    queryFn: () => attendanceApi.detail(id as number),
    enabled: id !== null && Number.isFinite(id) && id > 0,
    staleTime: 10_000
  })
}

// Keep the count in the events list in step with the detail without a second
// round trip — the register is used at a door, one scan a second.
function bumpCount(qc: QueryClient, eventId: number, delta: number) {
  qc.setQueryData<SocietyEvent[]>(qk.events, (rows) =>
    rows?.map((ev) => (ev.id === eventId ? { ...ev, attendee_count: Math.max(0, ev.attendee_count + delta) } : ev))
  )
}

// Move one member between the two lists in the cache. Marking sends them to
// the list the mode calls "marked"; unmarking sends them back, sorted by
// society ID the way the server returns the derived side.
function moveRow(detail: EventDetail, memberId: number, marking: boolean, at: string | null): EventDetail {
  const marked = detail.event.attendance_mode === 'absent' ? 'absent' : 'present'
  const derived = marked === 'absent' ? 'present' : 'absent'
  const from = marking ? derived : marked
  const to = marking ? marked : derived
  const row = detail[from].find((r) => r.member_id === memberId)
  if (!row) return detail
  const moved: AttendanceRow = { ...row, marked_at: marking ? at : null }
  const target = [...detail[to], moved]
  if (!marking) target.sort((a, b) => String(a.society_id).localeCompare(String(b.society_id), undefined, { numeric: true }))
  return {
    ...detail,
    [from]: detail[from].filter((r) => r.member_id !== memberId),
    [to]: marking ? [moved, ...detail[to]] : target
  }
}

// Marks are optimistic with rollback (requirements §6.8): the row moves the
// instant it is clicked and snaps back if the server refuses. A card scan
// cannot be optimistic — the member is unknown until the response resolves
// the society ID — so it settles on the result instead.
function useMarkMutation(eventId: number | null, marking: boolean) {
  const qc = useQueryClient()
  const key = qk.eventAttendance(eventId ?? 0)
  return useMutation({
    mutationFn: (memberId: number) =>
      marking ? attendanceApi.markByMember(eventId as number, memberId) : attendanceApi.unmark(eventId as number, memberId),
    onMutate: async (memberId: number) => {
      if (eventId === null) return
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<EventDetail>(key)
      const previousEvents = qc.getQueryData<SocietyEvent[]>(qk.events)
      if (previous) {
        const at = new Date().toISOString()
        qc.setQueryData<EventDetail>(key, moveRow(previous, memberId, marking, at))
        bumpCount(qc, eventId, presentDelta(previous.event.attendance_mode, marking))
      }
      return { previous, previousEvents }
    },
    onError: (_err, _memberId, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
      if (ctx?.previousEvents) qc.setQueryData(qk.events, ctx.previousEvents)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: qk.events })
    }
  })
}

export function useMarkMember(eventId: number | null) {
  return useMarkMutation(eventId, true)
}
export function useUnmarkMember(eventId: number | null) {
  return useMarkMutation(eventId, false)
}

export function useScanCard(eventId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (societyId: string) => attendanceApi.markByCard(eventId as number, societyId),
    onSuccess: (res) => {
      if (eventId === null || res.already) return
      void qc.invalidateQueries({ queryKey: qk.eventAttendance(eventId) })
      void qc.invalidateQueries({ queryKey: qk.events })
    }
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: CreateEventPayload) => attendanceApi.create(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.events })
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => attendanceApi.remove(id),
    onSuccess: async (_r, id) => {
      qc.removeQueries({ queryKey: qk.eventAttendance(id) })
      await qc.invalidateQueries({ queryKey: qk.events })
    }
  })
}

export function useSetMode(eventId: number | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mode: AttendanceMode) => attendanceApi.setMode(eventId as number, mode),
    onSuccess: async () => {
      if (eventId === null) return
      await Promise.all([qc.invalidateQueries({ queryKey: qk.eventAttendance(eventId) }), qc.invalidateQueries({ queryKey: qk.events })])
    }
  })
}
