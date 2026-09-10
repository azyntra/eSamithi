import { useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { AttendancePage } from '@/features/attendance/AttendancePage'
import type { AttendanceMode } from '@/features/attendance/types'

const searchSchema = z.object({
  event: z.coerce.number().int().positive().optional().catch(undefined),
  view: z.enum(['present', 'absent']).optional().catch(undefined),
  q: z.string().optional().catch(undefined)
})

export const Route = createFileRoute('/_app/attendance')({
  validateSearch: (search) => searchSchema.parse(search),
  component: AttendanceRoute
})

function AttendanceRoute() {
  const { event, view, q } = Route.useSearch()
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
          q: next.q !== undefined ? next.q || undefined : prev.q
        }),
        replace: true
      })
    },
    [navigate]
  )

  return <AttendancePage eventId={event ?? null} view={view ?? 'present'} search={q ?? ''} onNavigate={onNavigate} />
}
