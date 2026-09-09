import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { MEMBER_TABS, MemberPage } from '@/features/members/MemberPage'

const searchSchema = z.object({ tab: z.enum(MEMBER_TABS).optional().catch(undefined) })

export const Route = createFileRoute('/_app/members/$memberId')({
  params: {
    parse: (raw) => ({ memberId: Number(raw.memberId) }),
    stringify: (p) => ({ memberId: String(p.memberId) })
  },
  validateSearch: (search) => searchSchema.parse(search),
  component: MemberRoute
})

function MemberRoute() {
  const { memberId } = Route.useParams()
  const { tab } = Route.useSearch()
  // Belt and braces: params.parse should already give a number
  return <MemberPage memberId={Number(memberId)} tab={tab ?? 'overview'} />
}
