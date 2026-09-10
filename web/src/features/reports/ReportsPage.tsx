import { useMemo, useState } from 'react'
import { AlertTriangle, FileDown, Phone, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { PrintPreview } from '@/components/PrintPreview'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettings } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { downloadCsv, toCsv } from '@/lib/format/csv'
import { formatCurrency, formatNumber } from '@/lib/format/currency'
import { formatDate, todayIso } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buildReportHtml, type ReportSection } from './print'
import { useAnnualReport, useArrearsReport, useMonthlyReport } from './queries'
import type { CategoryRow, Summary } from './types'

export const REPORT_TABS = ['monthly', 'annual', 'arrears'] as const
export const ARREARS_TABS = ['overdue', 'fds', 'members'] as const
export type ReportTab = (typeof REPORT_TABS)[number]
export type ArrearsTab = (typeof ARREARS_TABS)[number]

const THIS_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, i) => THIS_YEAR - i)

function CategoryTable({ title, rows, total, tone }: { title: string; rows: CategoryRow[]; total: number; tone: 'success' | 'danger' }) {
  const { t } = useT()
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="border-b border-border px-4 py-3 text-sm font-semibold">{title}</div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('reports.category')}</TableHead>
            <TableHead className="text-right">{t('reports.entries')}</TableHead>
            <TableHead className="text-right">{t('common.total')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                {t('reports.noEntries')}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={`${r.code}-${r.name}`}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="tnum text-right text-muted-foreground">{formatNumber(r.entry_count)}</TableCell>
                <TableCell className="tnum text-right font-medium">{formatCurrency(r.total)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">{t('common.total')}</TableCell>
            <TableCell />
            <TableCell className={cn('tnum text-right font-bold', tone === 'success' ? 'text-success' : 'text-danger')}>{formatCurrency(total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  )
}

function SummaryTotals({ totals }: { totals: Summary['totals'] }) {
  const { t } = useT()
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard index={0} label={t('reports.totalIncome')} value={formatCurrency(totals.income)} tone="success" />
      <StatCard index={1} label={t('reports.totalExpenses')} value={formatCurrency(totals.expenses)} tone="danger" />
      <StatCard index={2} label={totals.net >= 0 ? t('reports.netSurplus') : t('reports.netDeficit')} value={formatCurrency(Math.abs(totals.net))} tone={totals.net >= 0 ? 'brand' : 'danger'} />
    </div>
  )
}

const ReportSkeleton = () => (
  <div className="grid gap-4">
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
    <Skeleton className="h-28 w-full" />
  </div>
)

interface ReportsPageProps {
  tab: ReportTab
  arrearsTab: ArrearsTab
  year: number
  month: number
  onChange: (patch: { tab?: ReportTab; arrears?: ArrearsTab; year?: number; month?: number }) => void
}

export function ReportsPage({ tab, arrearsTab, year, month, onChange }: ReportsPageProps) {
  const { t, lang, monthsLong } = useT()
  const settings = useSettings()
  const monthly = useMonthlyReport(year, month, tab === 'monthly')
  const annual = useAnnualReport(year, tab === 'annual')
  const arrears = useArrearsReport(tab === 'arrears')
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)

  const societyName = settings.data?.society_name || 'eSamithi'
  const address = settings.data?.society_address ?? null
  const phone = settings.data?.society_phone ?? null
  const active = tab === 'monthly' ? monthly : tab === 'annual' ? annual : arrears

  const periodLabel = tab === 'monthly' ? `${monthsLong[month - 1]} ${year}` : tab === 'annual' ? String(year) : ''
  const title = tab === 'monthly' ? t('reports.monthly') : tab === 'annual' ? t('reports.annual') : t('reports.arrears')

  const categorySections = (s: Summary): ReportSection[] => [
    {
      title: t('reports.incomeByCategory'),
      headers: [t('reports.category'), t('reports.entries'), t('common.total')],
      align: ['left', 'right', 'right'],
      rows: s.income.map((r) => [r.name, formatNumber(r.entry_count), formatCurrency(r.total)]),
      footer: [t('common.total'), '', formatCurrency(s.totals.income)]
    },
    {
      title: t('reports.expensesByCategory'),
      headers: [t('reports.category'), t('reports.entries'), t('common.total')],
      align: ['left', 'right', 'right'],
      rows: s.expenses.map((r) => [r.name, formatNumber(r.entry_count), formatCurrency(r.total)]),
      footer: [t('common.total'), '', formatCurrency(s.totals.expenses)]
    },
    {
      title: t('reports.period'),
      headers: [],
      align: ['left', 'right'],
      rows: [
        [t('reports.totalIncome'), formatCurrency(s.totals.income)],
        [t('reports.totalExpenses'), formatCurrency(s.totals.expenses)],
        [s.totals.net >= 0 ? t('reports.netSurplus') : t('reports.netDeficit'), formatCurrency(Math.abs(s.totals.net))]
      ]
    }
  ]

  const sections = useMemo<ReportSection[] | null>(() => {
    if (tab === 'monthly' && monthly.data) return categorySections(monthly.data)
    if (tab === 'annual' && annual.data) {
      const p = annual.data.position
      return [
        ...categorySections(annual.data),
        {
          title: t('reports.societyPosition'),
          headers: [],
          align: ['left', 'right'],
          rows: [
            [t('reports.activeMembers'), formatNumber(p.members)],
            [t('reports.cashInWallets'), formatCurrency(p.walletBalance)],
            [t('reports.fixedDeposits', { count: p.fdCount }), formatCurrency(p.fdPrincipal)],
            [t('reports.loansOutstanding', { count: p.activeLoans }), formatCurrency(p.loansOutstanding)]
          ],
          footer: [t('reports.totalFunds'), formatCurrency(p.walletBalance + p.fdPrincipal + p.loansOutstanding)]
        }
      ]
    }
    if (tab === 'arrears' && arrears.data) {
      const a = arrears.data
      return [
        {
          title: t('reports.overdueLoans', { count: a.overdueLoans.length }),
          headers: [t('reports.member'), t('common.phone'), t('reports.issued'), t('reports.principal'), t('reports.interest'), t('reports.fines'), t('reports.totalOwed')],
          align: ['left', 'left', 'left', 'right', 'right', 'right', 'right'],
          rows: a.overdueLoans.map((l) => [`${l.member_name} (${l.society_id})`, l.phone || '—', formatDate(l.date_issued, lang), formatCurrency(l.principal_owed), formatCurrency(l.interest_owed), formatCurrency(l.fines_owed), formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)])
        },
        {
          title: t('reports.fdsMaturing', { count: a.fdsMaturing.length }),
          headers: [t('reports.fdNumber'), t('reports.bank'), t('reports.principal'), t('reports.maturityDate')],
          align: ['left', 'left', 'right', 'right'],
          rows: a.fdsMaturing.map((f) => [f.fd_number, f.bank_name, formatCurrency(f.principal), formatDate(f.maturity_date, lang)])
        },
        {
          title: t('reports.membersWithoutFee'),
          headers: [t('reports.societyId'), t('common.name'), t('common.phone')],
          rows: (a.membersWithoutFee ?? []).map((m) => [m.society_id, m.full_name, m.phone || '—']),
          note: a.membersWithoutFee === null ? t('reports.liveModeNote') : undefined
        }
      ]
    }
    return null
  }, [tab, monthly.data, annual.data, arrears.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const print = () => {
    if (!sections) return
    setPreview({ title: `${title}${periodLabel ? ` — ${periodLabel}` : ''}`, html: buildReportHtml({ societyName, address, phone, title, period: periodLabel || undefined, sections }) })
  }

  const exportCsv = () => {
    if (!sections) return
    try {
      const lines: string[] = []
      for (const s of sections) {
        lines.push(toCsv([s.title], []))
        if (s.headers.length) lines.push(toCsv(s.headers, s.rows))
        else lines.push(toCsv([], s.rows))
        if (s.footer) lines.push(toCsv([], [s.footer]))
        lines.push('')
      }
      downloadCsv(`${tab}-report-${periodLabel ? periodLabel.replace(/\s+/g, '-').toLowerCase() : todayIso()}.csv`, lines.join('\r\n'))
      toast.success(t('ledger.exported', { count: sections.reduce((n, s) => n + s.rows.length, 0) }))
    } catch (e) {
      toast.error(errorMessage(e, t('ledger.exportFailed')))
    }
  }

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={exportCsv} disabled={!sections}>
              <FileDown /> {t('ledger.exportCsv')}
            </Button>
            <Button onClick={print} disabled={!sections} title={t('reports.printHint')}>
              <Printer /> {t('reports.print')}
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => onChange({ tab: v as ReportTab })}>
        <TabsList>
          <TabsTrigger value="monthly">{t('reports.monthly')}</TabsTrigger>
          <TabsTrigger value="annual">{t('reports.annual')}</TabsTrigger>
          <TabsTrigger value="arrears">{t('reports.arrears')}</TabsTrigger>
        </TabsList>

        {tab !== 'arrears' && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            <span className="text-sm font-medium">{t('reports.period')}</span>
            {tab === 'monthly' && (
              <NativeSelect aria-label={t('reports.period')} className="w-auto min-w-36" value={month} onChange={(e) => onChange({ month: Number(e.target.value) })}>
                {monthsLong.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <NativeSelect aria-label={t('reports.yearStatement', { year })} className="w-auto min-w-28" value={year} onChange={(e) => onChange({ year: Number(e.target.value) })}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        {active.isError ? (
          <EmptyState icon={<AlertTriangle />} title={t('reports.loadFailed')} description={errorMessage(active.error)} action={<Button onClick={() => void active.refetch()}>{t('common.tryAgain')}</Button>} />
        ) : (
          <>
            <TabsContent value="monthly">
              {monthly.isPending || !monthly.data ? (
                <ReportSkeleton />
              ) : (
                <div className="grid gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">
                      {monthsLong[monthly.data.month - 1]} {monthly.data.year}
                    </h2>
                    <Badge variant="default" className="tnum">
                      {formatDate(monthly.data.from, lang)} → {formatDate(monthly.data.to, lang)}
                    </Badge>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CategoryTable title={t('reports.incomeByCategory')} rows={monthly.data.income} total={monthly.data.totals.income} tone="success" />
                    <CategoryTable title={t('reports.expensesByCategory')} rows={monthly.data.expenses} total={monthly.data.totals.expenses} tone="danger" />
                  </div>
                  <SummaryTotals totals={monthly.data.totals} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="annual">
              {annual.isPending || !annual.data ? (
                <ReportSkeleton />
              ) : (
                <div className="grid gap-4">
                  <h2 className="text-lg font-semibold">{t('reports.yearStatement', { year: annual.data.year })}</h2>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CategoryTable title={t('reports.incomeByCategory')} rows={annual.data.income} total={annual.data.totals.income} tone="success" />
                    <CategoryTable title={t('reports.expensesByCategory')} rows={annual.data.expenses} total={annual.data.totals.expenses} tone="danger" />
                  </div>
                  <SummaryTotals totals={annual.data.totals} />
                  <Card className="gap-0 overflow-hidden py-0">
                    <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('reports.societyPosition')}</div>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell>{t('reports.activeMembers')}</TableCell>
                          <TableCell className="tnum text-right font-medium">{formatNumber(annual.data.position.members)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t('reports.cashInWallets')}</TableCell>
                          <TableCell className="tnum text-right font-medium">{formatCurrency(annual.data.position.walletBalance)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t('reports.fixedDeposits', { count: annual.data.position.fdCount })}</TableCell>
                          <TableCell className="tnum text-right font-medium">{formatCurrency(annual.data.position.fdPrincipal)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>{t('reports.loansOutstanding', { count: annual.data.position.activeLoans })}</TableCell>
                          <TableCell className="tnum text-right font-medium">{formatCurrency(annual.data.position.loansOutstanding)}</TableCell>
                        </TableRow>
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell className="font-semibold">{t('reports.totalFunds')}</TableCell>
                          <TableCell className="tnum text-right font-bold text-primary">{formatCurrency(annual.data.position.walletBalance + annual.data.position.fdPrincipal + annual.data.position.loansOutstanding)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="arrears">
              {arrears.isPending || !arrears.data ? (
                <ReportSkeleton />
              ) : (
                <Tabs value={arrearsTab} onValueChange={(v) => onChange({ arrears: v as ArrearsTab })}>
                  <TabsList>
                    <TabsTrigger value="overdue">
                      {t('reports.tabOverdue')} <span className="tnum ml-1 rounded-full bg-muted px-1.5 text-[11px]">{arrears.data.overdueLoans.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="fds">
                      {t('reports.tabFds')} <span className="tnum ml-1 rounded-full bg-muted px-1.5 text-[11px]">{arrears.data.fdsMaturing.length}</span>
                    </TabsTrigger>
                    <TabsTrigger value="members">
                      {t('reports.tabUnpaidFees')}
                      {arrears.data.membersWithoutFee && <span className="tnum ml-1 rounded-full bg-muted px-1.5 text-[11px]">{arrears.data.membersWithoutFee.length}</span>}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="overdue">
                    <Card className="gap-0 overflow-hidden py-0">
                      <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold">
                        <AlertTriangle className="size-4 text-danger" /> {t('reports.overdueLoans', { count: arrears.data.overdueLoans.length })}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('reports.member')}</TableHead>
                            <TableHead>{t('common.phone')}</TableHead>
                            <TableHead>{t('reports.issued')}</TableHead>
                            <TableHead className="text-right">{t('reports.principal')}</TableHead>
                            <TableHead className="text-right">{t('reports.interest')}</TableHead>
                            <TableHead className="text-right">{t('reports.fines')}</TableHead>
                            <TableHead className="text-right">{t('reports.totalOwed')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {arrears.data.overdueLoans.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                {t('reports.noOverdue')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            arrears.data.overdueLoans.map((l) => (
                              <TableRow key={l.id}>
                                <TableCell>
                                  <div className="font-medium">{l.member_name}</div>
                                  <div className="tnum text-[11px] text-muted-foreground">{l.society_id}</div>
                                </TableCell>
                                <TableCell className="tnum">{l.phone ? <span className="inline-flex items-center gap-1"><Phone className="size-3" />{l.phone}</span> : '—'}</TableCell>
                                <TableCell className="tnum whitespace-nowrap">{formatDate(l.date_issued, lang)}</TableCell>
                                <TableCell className="tnum text-right">{formatCurrency(l.principal_owed)}</TableCell>
                                <TableCell className="tnum text-right">{formatCurrency(l.interest_owed)}</TableCell>
                                <TableCell className="tnum text-right text-danger">{formatCurrency(l.fines_owed)}</TableCell>
                                <TableCell className="tnum text-right font-bold">{formatCurrency(l.principal_owed + l.interest_owed + l.fines_owed)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </TabsContent>

                  <TabsContent value="fds">
                    <Card className="gap-0 overflow-hidden py-0">
                      <div className="border-b border-border px-4 py-3 text-sm font-semibold">{t('reports.fdsMaturing', { count: arrears.data.fdsMaturing.length })}</div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('reports.fdNumber')}</TableHead>
                            <TableHead>{t('reports.bank')}</TableHead>
                            <TableHead className="text-right">{t('reports.principal')}</TableHead>
                            <TableHead className="text-right">{t('reports.maturityDate')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {arrears.data.fdsMaturing.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                                {t('reports.nothingMaturing')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            arrears.data.fdsMaturing.map((f) => {
                              const matured = f.maturity_date.slice(0, 10) <= todayIso()
                              return (
                                <TableRow key={f.id}>
                                  <TableCell className="font-mono font-medium">{f.fd_number}</TableCell>
                                  <TableCell>{f.bank_name}</TableCell>
                                  <TableCell className="tnum text-right">{formatCurrency(f.principal)}</TableCell>
                                  <TableCell className={cn('tnum text-right', matured && 'font-bold text-danger')}>
                                    {formatDate(f.maturity_date, lang)}
                                    {matured ? t('reports.matured') : ''}
                                  </TableCell>
                                </TableRow>
                              )
                            })
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  </TabsContent>

                  <TabsContent value="members">
                    <Card className="gap-0 overflow-hidden py-0">
                      <div className="border-b border-border px-4 py-3 text-sm font-semibold">
                        {t('reports.membersWithoutFee')}
                        {arrears.data.membersWithoutFee ? ` (${arrears.data.membersWithoutFee.length})` : ''}
                      </div>
                      {arrears.data.membersWithoutFee === null ? (
                        <CardContent className="py-6 text-sm text-muted-foreground">{t('reports.liveModeNote')}</CardContent>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('reports.societyId')}</TableHead>
                              <TableHead>{t('common.name')}</TableHead>
                              <TableHead>{t('common.phone')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {arrears.data.membersWithoutFee.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                                  {t('reports.everyonePaid')}
                                </TableCell>
                              </TableRow>
                            ) : (
                              arrears.data.membersWithoutFee.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell className="tnum font-medium">{m.society_id}</TableCell>
                                  <TableCell>{m.full_name}</TableCell>
                                  <TableCell className="tnum">{m.phone || '—'}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      )}
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      <PrintPreview open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.title ?? ''} html={preview?.html ?? null} />
    </>
  )
}
