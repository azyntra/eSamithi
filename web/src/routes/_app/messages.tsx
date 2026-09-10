import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { MessagesPage } from '@/features/messages/MessagesPage'

const searchSchema = z.object({
  tab: z.enum(['announcements', 'requests', 'puruka']).optional().catch(undefined),
  status: z.enum(['pending', 'all']).optional().catch(undefined)
})

export const Route = createFileRoute('/_app/messages')({
  validateSearch: (search) => searchSchema.parse(search),
  component: MessagesRoute
})

function MessagesRoute() {
  const { tab, status } = Route.useSearch()
  const navigate = Route.useNavigate()

  // Both the tab and the request filter live in the URL: the pending queue is
  // a link a treasurer can keep open.
  return (
    <MessagesPage
      tab={tab ?? 'announcements'}
      pendingOnly={(status ?? 'pending') === 'pending'}
      onTabChange={(next) => void navigate({ search: (prev) => ({ ...prev, tab: next === 'announcements' ? undefined : next }), replace: true })}
      onFilterChange={(pending) => void navigate({ search: (prev) => ({ ...prev, status: pending ? undefined : 'all' }), replace: true })}
    />
  )
}
