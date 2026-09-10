import { createFileRoute } from '@tanstack/react-router'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { flag, oneOf } from '@/lib/router/search'

const tabOf = oneOf(['announcements', 'requests', 'puruka'] as const)
const statusOf = oneOf(['pending', 'all'] as const)

export const Route = createFileRoute('/_app/messages')({
  validateSearch: (search: Record<string, unknown>): { tab?: 'announcements' | 'requests' | 'puruka'; status?: 'pending' | 'all'; create?: 1 } => ({
    tab: tabOf(search.tab),
    status: statusOf(search.status),
    create: flag(search.create)
  }),
  component: MessagesRoute
})

function MessagesRoute() {
  const { tab, status, create } = Route.useSearch()
  const navigate = Route.useNavigate()

  // Both the tab and the request filter live in the URL: the pending queue is
  // a link a treasurer can keep open.
  return (
    <MessagesPage
      tab={tab ?? 'announcements'}
      pendingOnly={(status ?? 'pending') === 'pending'}
      create={Boolean(create)}
      onCreateHandled={() => void navigate({ search: (prev) => ({ ...prev, create: undefined }), replace: true })}
      onTabChange={(next) => void navigate({ search: (prev) => ({ ...prev, tab: next === 'announcements' ? undefined : next }), replace: true })}
      onFilterChange={(pending) => void navigate({ search: (prev) => ({ ...prev, status: pending ? undefined : 'all' }), replace: true })}
    />
  )
}
