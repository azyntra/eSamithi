import { createFileRoute } from '@tanstack/react-router'
import { MembersPage } from '@/features/members/MembersPage'
import { flag, int, oneOfNum, str } from '@/lib/router/search'

const sizeOf = oneOfNum([15, 30, 50] as const)

export const Route = createFileRoute('/_app/members/')({
  validateSearch: (search: Record<string, unknown>): { q?: string; page?: number; size?: 15 | 30 | 50; create?: 1; scan?: 1 } => ({
    q: str(search.q),
    page: int(search.page),
    size: sizeOf(search.size),
    create: flag(search.create),
    scan: flag(search.scan)
  }),
  component: MembersRoute
})

function MembersRoute() {
  const { q, page, size, create, scan } = Route.useSearch()
  return <MembersPage q={q ?? ''} page={page ?? 1} size={size ?? 15} create={Boolean(create)} scan={Boolean(scan)} />
}
