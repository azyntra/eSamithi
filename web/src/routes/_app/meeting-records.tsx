import { useCallback } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MeetingRecordsPage, type MeetingRecordsView } from '@/features/meeting-records/MeetingRecordsPage'
import { flag, int, oneOf } from '@/lib/router/search'

const statusOf = oneOf(['published', 'drafts', 'withdrawn'] as const)

// Everything that picks what is on screen lives in the URL, so a report (or a
// version of it) is a link the office can share (§4.1)
export const Route = createFileRoute('/_app/meeting-records')({
  validateSearch: (search: Record<string, unknown>): MeetingRecordsView => {
    const month = int(search.month)
    return {
      year: int(search.year, 2000),
      month: month !== undefined && month <= 12 ? month : undefined,
      status: statusOf(search.status),
      report: int(search.report),
      v: int(search.v),
      edit: int(search.edit),
      create: flag(search.create)
    }
  },
  component: MeetingRecordsRoute
})

function MeetingRecordsRoute() {
  const view = Route.useSearch()
  const navigate = Route.useNavigate()
  const onChange = useCallback(
    (next: MeetingRecordsView, replace = false) => void navigate({ search: next, replace }),
    [navigate]
  )
  return <MeetingRecordsPage view={view} onChange={onChange} />
}
