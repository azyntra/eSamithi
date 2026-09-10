import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoansPage } from '@/features/loans/LoansPage'
import { flagSchema } from '@/lib/router/flags'

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  sort: z.enum(['date_issued', 'principal_amount', 'balance']).optional().catch(undefined),
  dir: z.enum(['asc', 'desc']).optional().catch(undefined),
  create: flagSchema
})

export const Route = createFileRoute('/_app/loans/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: LoansRoute
})

function LoansRoute() {
  const { q, sort, dir, create } = Route.useSearch()
  // Default: member ID ascending (desktop 1.3.6 parity)
  const key = sort ?? 'member_id'
  return <LoansPage q={q ?? ''} sort={key} dir={dir ?? (key === 'member_id' ? 'asc' : 'desc')} create={Boolean(create)} />
}
