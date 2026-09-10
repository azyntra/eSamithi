import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatRupees } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { balanceOf, headroomOf, isOpen, type Loan } from '../types'

// The borrower's running loans, shown inside the entry forms so the officer
// sees existing exposure before granting more (partial borrowing, FR-6.2).
export function ExistingLoansPanel({ loans, memberId, maxLoanLimit, showHeadroom = false }: { loans: Loan[]; memberId: number | null; maxLoanLimit: number; showHeadroom?: boolean }) {
  const { t, lang } = useT()
  if (!memberId) return null
  const active = loans.filter((l) => l.member_id === memberId && isOpen(l))
  if (active.length === 0) return null

  const totalOutstanding = active.reduce((s, l) => s + balanceOf(l), 0)
  const headroom = headroomOf(loans, memberId, maxLoanLimit)

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
      <div className="mb-2 font-semibold">
        {t('lform.existingLoans')} ({active.length})
      </div>
      <ul className="grid gap-1">
        {active.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">
              <span className="tnum">{formatDate(l.date_issued, lang)}</span> · <span className="tnum">{formatCurrency(l.principal_amount)}</span>
              {l.status === 'Overdue' && (
                <Badge variant="danger" className="ml-2">
                  {t('rcpt.stOverdue')}
                </Badge>
              )}
            </span>
            <span className="tnum font-medium">{formatCurrency(balanceOf(l))}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 font-semibold">
        <span>{t('lform.totalOutstandingShort')}</span>
        <span className="tnum text-danger">{formatCurrency(totalOutstanding)}</span>
      </div>
      {showHeadroom && headroom !== null && (
        <div className={cn('mt-1.5 font-semibold', headroom > 0 ? 'text-success' : 'text-danger')}>
          {headroom > 0 ? t('lform.headroomRemaining', { amount: formatCurrency(headroom) }) : t('lform.noHeadroom', { max: formatRupees(maxLoanLimit) })}
        </div>
      )}
    </div>
  )
}
