import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { MembersPage } from '@/features/members/MembersPage'
import { flagSchema } from '@/lib/router/flags'

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  size: z.coerce
    .number()
    .int()
    .refine((n) => [15, 30, 50].includes(n))
    .optional()
    .catch(undefined),
  create: flagSchema,
  scan: flagSchema
})

export const Route = createFileRoute('/_app/members/')({
  validateSearch: (search) => searchSchema.parse(search),
  component: MembersRoute
})

function MembersRoute() {
  const { q, page, size, create, scan } = Route.useSearch()
  return <MembersPage q={q ?? ''} page={page ?? 1} size={size ?? 15} create={Boolean(create)} scan={Boolean(scan)} />
}
