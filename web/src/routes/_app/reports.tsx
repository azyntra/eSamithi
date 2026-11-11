import { createFileRoute } from '@tanstack/react-router'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { APP_USAGE_FILTERS, ARREARS_TABS, REPORT_TABS } from '@/features/reports/tabs'
import { int, oneOf } from '@/lib/router/search'

const now = new Date()
const tabOf = oneOf(REPORT_TABS)
const arrearsOf = oneOf(ARREARS_TABS)
const usageOf = oneOf(APP_USAGE_FILTERS)

export const Route = createFileRoute('/_app/reports')({
  validateSearch: (search: Record<string, unknown>): { tab?: (typeof REPORT_TABS)[number]; arrears?: (typeof ARREARS_TABS)[number]; usage?: (typeof APP_USAGE_FILTERS)[number]; year?: number; month?: number } => {
    const year = int(search.year, 2000)
    const month = int(search.month, 1)
    return {
      tab: tabOf(search.tab),
      arrears: arrearsOf(search.arrears),
      usage: usageOf(search.usage),
      year: year !== undefined && year <= 2100 ? year : undefined,
      month: month !== undefined && month <= 12 ? month : undefined
    }
  },
  component: ReportsRoute
})

function ReportsRoute() {
  const { tab, arrears, usage, year, month } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ReportsPage
      tab={tab ?? 'monthly'}
      arrearsTab={arrears ?? 'overdue'}
      usageFilter={usage ?? 'all'}
      year={year ?? now.getFullYear()}
      month={month ?? now.getMonth() + 1}
      onChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })}
    />
  )
}
