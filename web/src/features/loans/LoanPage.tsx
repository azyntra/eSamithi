import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Archive, ArrowLeft, HandCoins, Printer, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PrintPreview } from '@/components/PrintPreview'
import { StatCard } from '@/components/StatCard'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/features/settings/queries'
import { errorMessage, isApiError } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { RepayLoanDialog } from './components/RepayLoanDialog'
import { useDeleteLoan, useLoan } from './queries'
import { loanPaymentReceiptHtml, loanStatementHtml } from './receipts'
import { balanceOf, isOpen, type LoanPayment } from './types'

export function LoanPage({ loanId }: { loanId: number }) {
  const { t, lang } = useT()
  const navigate = useNavigate()
  const settings = useSettings()
  const loan = useLoan(loanId)
  const remove = useDeleteLoan()
  const [repaying, setRepaying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)
  const societyName = settings.data?.society_name || 'eSamithi'

  const backLink = (
    <Button asChild variant="link" size="sm" className="mb-3 h-auto px-0 text-muted-foreground">
      <Link to="/loans" search={{ q: undefined, sort: undefined, dir: undefined }}>
        <ArrowLeft /> {t('nav.loans')}
      </Link>
    </Button>
  )

  if (loan.isPending) {
    return (
      <>
        {backLink}
        <div className="grid gap-6">
          <Skeleton className="h-9 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-56 w-full" />
        </div>
      </>
    )
  }
  if (loan.isError || !loan.data) {
    const notFound = isApiError(loan.error) && loan.error.status === 404
    return (
      <>
        {backLink}
        <EmptyState icon={<AlertTriangle />} title={notFound ? t('lform.loadFailed') : t('common.somethingWrong')} description={notFound ? undefined : errorMessage(loan.error)} action={<Button onClick={() => void loan.refetch()}>{t('common.tryAgain')}</Button>} />
      </>
    )
  }

  const l = loan.data
  const totalOwed = balanceOf(l)
  const printPayment = (p: LoanPayment) => setPreview({ title: t('ledger.printReceipt'), html: loanPaymentReceiptHtml(l, p, societyName) })
  const printStatement = () => setPreview({ title: t('lform.printStatement'), html: loanStatementHtml(l, societyName) })

  return (
    <>
      {backLink}

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
            {l.member_name}
            {Number(l.is_migrated) === 1 && (
              <Badge variant="neutral" className="gap-1" title={t('loans.migratedHint')}>
                <Archive /> {t('loans.migrated')}
              </Badge>
            )}
            <StatusPill value={l.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {l.member_society_id && <span className="tnum font-medium text-foreground">{l.member_society_id}</span>}
            {l.member_society_id && l.member_nic ? ' · ' : ''}
            <span className="tnum">{l.member_nic || '—'}</span> · {t('lform.issuedShort')} <span className="tnum">{formatDate(l.date_issued, lang)}</span>
            {l.purpose ? ` · ${l.purpose}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={printStatement}>
            <Printer /> {t('lform.printStatement')}
          </Button>
          {isOpen(l) && (
            <Button onClick={() => setRepaying(true)}>
              <HandCoins /> {t('loans.recordRepayment')}
            </Button>
          )}
          <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('loans.deletePermanently')} onClick={() => setDeleting(true)}>
            <Trash2 />
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label={t('lform.originalPrincipalShort')} value={formatCurrency(l.principal_amount)} tone="neutral" />
        <StatCard index={1} label={t('lform.remainingPrincipal')} value={formatCurrency(l.principal_owed)} tone="brand" />
        <StatCard index={2} label={t('lform.outstandingInterest')} value={formatCurrency(l.interest_owed)} tone={l.interest_owed > 0 ? 'danger' : 'neutral'} />
        <StatCard index={3} label={t('lform.outstandingFine')} value={formatCurrency(l.fines_owed)} tone={l.fines_owed > 0 ? 'danger' : 'neutral'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="size-4 text-primary" /> {t('lform.guarantorsCount', { count: l.guarantors.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {l.guarantors.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                {t('lform.noGuarantors')}
                {Number(l.is_migrated) === 1 ? t('lform.migratedSuffix') : ''}
              </p>
            ) : (
              l.guarantors.map((g) => (
                <div key={g.id} className="rounded-lg border border-border bg-muted/40 px-4 py-2.5">
                  <div className="font-medium">{g.full_name}</div>
                  <div className="tnum text-xs text-muted-foreground">
                    {g.nic || '—'}
                    {g.phone ? ` · ${g.phone}` : ''}
                  </div>
                </div>
              ))
            )}
            <div className="mt-1 flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="font-semibold">{t('lform.totalOutstanding')}</span>
              <span className="tnum text-lg font-bold text-danger">{formatCurrency(totalOwed)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-3">
          <CardHeader>
            <CardTitle className="text-sm">{t('lform.repaymentHistory', { count: l.payments.length })}</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {l.payments.length === 0 ? (
              <p className="px-5 text-sm text-muted-foreground italic">{t('lform.noRepayments')}</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead className="text-right">{t('lform.fine')}</TableHead>
                      <TableHead className="text-right">{t('reports.interest')}</TableHead>
                      <TableHead className="text-right">{t('reports.principal')}</TableHead>
                      <TableHead className="text-right">{t('common.total')}</TableHead>
                      <TableHead className="text-center">{t('lform.receipt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {l.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="tnum whitespace-nowrap">{formatDate(p.date, lang)}</TableCell>
                        <TableCell className="tnum text-right">{formatCurrency(p.fines_paid)}</TableCell>
                        <TableCell className="tnum text-right">{formatCurrency(p.interest_paid)}</TableCell>
                        <TableCell className="tnum text-right">{formatCurrency(p.principal_paid)}</TableCell>
                        <TableCell className="tnum text-right font-semibold">{formatCurrency(p.fines_paid + p.interest_paid + p.principal_paid)}</TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={t('ledger.printReceipt')} onClick={() => printPayment(p)}>
                                <Printer />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t('ledger.printReceipt')}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RepayLoanDialog loan={repaying ? l : null} onOpenChange={(o) => !o && setRepaying(false)} onRepaid={(r) => { if (r.allocation) void loan.refetch() }} />
      <PrintPreview open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.title ?? ''} html={preview?.html ?? null} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        danger
        title={t('loans.deleteTitle')}
        description={
          <>
            {t('loans.deleteMsg', { name: l.member_name ?? '' })} {Number(l.is_migrated) === 1 ? t('loans.deleteMsgMigrated') : t('loans.deleteMsgNormal')}
          </>
        }
        typeToConfirm={l.member_society_id ?? undefined}
        confirmLabel={t('loans.deletePermanently')}
        busy={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(l.id)
            toast.success(t('loans.deleted'))
            void navigate({ to: '/loans', search: { q: undefined, sort: undefined, dir: undefined } })
          } catch (e) {
            toast.error(errorMessage(e, t('loans.deleteFailed')))
          }
        }}
      />
    </>
  )
}
