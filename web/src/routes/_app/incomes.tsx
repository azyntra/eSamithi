import { createFileRoute } from '@tanstack/react-router'
import { LedgerPage } from '@/features/ledger/LedgerPage'
import { ledgerSearchSchema } from '@/features/ledger/filters'

export const Route = createFileRoute('/_app/incomes')({
  validateSearch: (search) => ledgerSearchSchema.parse(search),
  component: IncomesRoute
})

function IncomesRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  return <LedgerPage kind="income" search={search} onSearchChange={(patch) => void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })} />
}
