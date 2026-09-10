import { useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import type { AttendanceMode } from '@/features/attendance/types'
import { flag, int, oneOf, str } from '@/lib/router/search'

const viewOf = oneOf(['present', 'absent'] as const)

export const Route = createFileRoute('/_app/attendance')({
  validateSearch: (search: Record<string, unknown>): { event?: number; view?: AttendanceMode; q?: string; create?: 1 } => ({
    event: int(search.event),
    view: viewOf(search.view),
    q: str(search.q),
    create: flag(search.create)
  }),
  component: AttendanceRoute
})

function AttendanceRoute() {
  const { event, view, q, create } = Route.useSearch()
  const navigate = useNavigate()

  // Event, tab and search all live in the URL so a counter can be reopened
  // (or handed to a second staff member) exactly where it was.
  const onNavigate = useCallback(
    (next: { event?: number | null; view?: AttendanceMode; q?: string }) => {
      void navigate({
        to: '/attendance',
        search: (prev: { event?: number; view?: AttendanceMode; q?: string }) => ({
          event: next.event === null ? undefined : (next.event ?? prev.event),
          view: next.view ?? prev.view,
          q: next.q !== undefined ? next.q || undefined : prev.q,
          create: undefined
        }),
        replace: true
      })
    },
    [navigate]
  )

  return <AttendancePage eventId={event ?? null} view={view ?? 'present'} search={q ?? ''} create={Boolean(create)} onNavigate={onNavigate} />
}
