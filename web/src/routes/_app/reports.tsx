import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ARREARS_TABS, REPORT_TABS, ReportsPage } from '@/features/reports/ReportsPage'

const now = new Date()
const searchSchema = z.object({
  tab: z.enum(REPORT_TABS).optional().catch(undefined),
  arrears: z.enum(ARREARS_TABS).optional().catch(undefined),
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  month: z.coerce.number().int().min(1).max(12).optional().catch(undefined)
})

export const Route = createFileRoute('/_app/reports')({
  validateSearch: (search) => searchSchema.parse(search),
  component: ReportsRoute
})

function ReportsRoute() {
  const { tab, arrears, year, month } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ReportsPage
      tab={tab ?? 'monthly'}
      arrearsTab={arrears ?? 'overdue'}
      year={year ?? now.getFullYear()}
      month={month ?? now.getMonth() + 1}
      onChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
    />
  )
}
