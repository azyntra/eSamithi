import { createFileRoute } from '@tanstack/react-router'
import { LoansPage } from '@/features/loans/LoansPage'
import { flag, oneOf, str } from '@/lib/router/search'

const sortOf = oneOf(['date_issued', 'principal_amount', 'balance'] as const)
const dirOf = oneOf(['asc', 'desc'] as const)

export const Route = createFileRoute('/_app/loans/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; sort?: 'date_issued' | 'principal_amount' | 'balance'; dir?: 'asc' | 'desc'; create?: 1 } => ({
    q: str(search.q),
    sort: sortOf(search.sort),
    dir: dirOf(search.dir),
    create: flag(search.create)
  }),
  component: LoansRoute
})

function LoansRoute() {
  const { q, sort, dir, create } = Route.useSearch()
  // Default: member ID ascending (desktop 1.3.6 parity)
  const key = sort ?? 'member_id'
  return <LoansPage q={q ?? ''} sort={key} dir={dir ?? (key === 'member_id' ? 'asc' : 'desc')} create={Boolean(create)} />
}
