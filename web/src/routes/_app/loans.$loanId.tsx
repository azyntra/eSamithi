import { createFileRoute } from '@tanstack/react-router'
import { LoanPage } from '@/features/loans/LoanPage'

export const Route = createFileRoute('/_app/loans/$loanId')({
  params: {
    parse: (raw) => ({ loanId: Number(raw.loanId) }),
    stringify: (p) => ({ loanId: String(p.loanId) })
  },
  component: LoanRoute
})

function LoanRoute() {
  const { loanId } = Route.useParams()
  return <LoanPage loanId={Number(loanId)} />
}
