import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ModulePlaceholder } from '@/components/ModulePlaceholder'

// `member` is the record-payment handoff from Member 360 (consumed by the
// ledger page that replaces this placeholder in Phase 1).
const searchSchema = z.object({ member: z.coerce.number().int().optional().catch(undefined) })

export const Route = createFileRoute('/_app/incomes')({
  validateSearch: (search) => searchSchema.parse(search),
  component: () => <ModulePlaceholder titleKey="nav.incomes" phase={1} />
})
