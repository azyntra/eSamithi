import { createFileRoute } from '@tanstack/react-router'
import { MemberPage } from '@/features/members/MemberPage'
import { MEMBER_TABS } from '@/features/members/tabs'
import { oneOf } from '@/lib/router/search'

const tabOf = oneOf(MEMBER_TABS)

export const Route = createFileRoute('/_app/members/$memberId')({
  params: {
    parse: (raw) => ({ memberId: Number(raw.memberId) }),
    stringify: (p) => ({ memberId: String(p.memberId) })
  },
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof MEMBER_TABS)[number] } => ({ tab: tabOf(search.tab) }),
  component: MemberRoute
})

function MemberRoute() {
  const { memberId } = Route.useParams()
  const { tab } = Route.useSearch()
  // Belt and braces: params.parse should already give a number
  return <MemberPage memberId={Number(memberId)} tab={tab ?? 'overview'} />
}
