import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { ARREARS_TABS, REPORT_TABS } from '@/features/reports/tabs'
import { int, oneOf } from '@/lib/router/search'

const now = new Date()
const tabOf = oneOf(REPORT_TABS)
const arrearsOf = oneOf(ARREARS_TABS)

export const Route = createFileRoute('/_app/reports')({
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof REPORT_TABS)[number]; arrears?: (typeof ARREARS_TABS)[number]; year?: number; month?: number } => {
    const year = int(search.year, 2000)
    const month = int(search.month, 1)
    return {
      tab: tabOf(search.tab),
      arrears: arrearsOf(search.arrears),
      year: year !== undefined && year <= 2100 ? year : undefined,
      month: month !== undefined && month <= 12 ? month : undefined
    }
  },
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
