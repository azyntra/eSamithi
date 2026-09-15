import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { AlertTriangle, Eye, HandCoins, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMigrationMode } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useT } from '@/lib/i18n'
import { IssueLoanSheet } from './components/IssueLoanSheet'
import { LoanKindChooser, type LoanKind } from './components/LoanKindChooser'
import { MigrateLoanSheet } from './components/MigrateLoanSheet'
import { RepayLoanDialog } from './components/RepayLoanDialog'
import { useDeleteLoan, useLoans } from './queries'
import { balanceOf, isOpen, type Loan } from './types'
import { memberLabel } from '@/lib/members'

export function LoansPage({ q, sort, dir, create = false }: { q: string; sort: string; dir: 'asc' | 'desc'; create?: boolean }) {
  const { t, lang } = useT()
  const navigate = useNavigate({ from: '/loans/' })
  const loans = useLoans()
  const migration = useMigrationMode() === true
  const remove = useDeleteLoan()
  const [text, setText] = useState(q)
  const debounced = useDebouncedValue(text.trim(), 300)
  const [entry, setEntry] = useState<LoanKind | null>(null)

  // Quick action from the command palette: /loans?create=1
  useEffect(() => {
    if (!create) return
    setEntry('new')
    void navigate({ search: (prev) => ({ ...prev, create: undefined }), replace: true })
  }, [create]) // eslint-disable-line react-hooks/exhaustive-deps
  const [repaying, setRepaying] = useState<Loan | null>(null)
  const [deleting, setDeleting] = useState<Loan | null>(null)

  useEffect(() => {
    if (debounced !== q) void navigate({ search: (prev) => ({ ...prev, q: debounced || undefined }), replace: true })
  }, [debounced, q, navigate])

  const rows = useMemo(() => loans.data ?? [], [loans.data])
  const totalOwed = rows.filter(isOpen).reduce((s, l) => s + balanceOf(l), 0)

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return rows
    return rows.filter(
      (l) =>
        l.member_name?.toLowerCase().includes(query) ||
        l.member_nic?.toLowerCase().includes(query) ||
        String(l.member_society_id ?? '').toLowerCase().includes(query) ||
        l.purpose?.toLowerCase().includes(query)
    )
  }, [rows, q])

  // Member ID is the default order (natural, so 2 < 10), newest first per member
  const sorted = useMemo(() => {
    const copy = [...filtered]
    copy.sort((a, b) => {
      let cmp = 0
      if (sort === 'member_id') {
        cmp = String(a.member_society_id ?? '').localeCompare(String(b.member_society_id ?? ''), undefined, { numeric: true })
        if (cmp === 0) cmp = new Date(b.date_issued).getTime() - new Date(a.date_issued).getTime()
      } else if (sort === 'date_issued') cmp = new Date(a.date_issued).getTime() - new Date(b.date_issued).getTime()
      else if (sort === 'principal_amount') cmp = a.principal_amount - b.principal_amount
      else cmp = balanceOf(a) - balanceOf(b)
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sort, dir])

  const sorting: SortingState = [{ id: sort, desc: dir === 'desc' }]
  const onSortingChange: (u: unknown) => void = (updater) => {
    const next = typeof updater === 'function' ? (updater as (s: SortingState) => SortingState)(sorting) : (updater as SortingState)
    const first = next[0]
    // Member ID reads top-down so it opens ascending; money and date columns
    // open descending (biggest and newest first), exactly like the desktop.
    if (!first) return
    const nextDir = first.id === sort ? (dir === 'asc' ? 'desc' : 'asc') : first.id === 'member_id' ? 'asc' : 'desc'
    void navigate({ search: (prev) => ({ ...prev, sort: first.id === 'member_id' ? undefined : (first.id as 'date_issued'), dir: nextDir === (first.id === 'member_id' ? 'asc' : 'desc') ? undefined : nextDir }), replace: true })
  }

  const columns = useMemo<ColumnDef<Loan, unknown>[]>(
    () => [
      {
        id: 'date_issued',
        accessorKey: 'date_issued',
        header: t('loans.issuedDate'),
        meta: { width: '10rem' },
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="tnum font-medium whitespace-nowrap">{formatDate(row.original.date_issued, lang)}</div>
            <div className="truncate text-xs text-muted-foreground italic">{row.original.purpose || t('loans.personalLoan')}</div>
          </div>
        )
      },
      {
        id: 'member_id',
        // TanStack Table only offers sorting on columns with an accessor
        accessorFn: (l) => l.member_society_id ?? '',
        header: t('loans.memberApplicant'),
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link to="/loans/$loanId" params={{ loanId: l.id }} className="truncate font-medium hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  {memberLabel({ full_name: l.member_name }, t('members.unnamed'))}
                </Link>
                {Number(l.is_migrated) === 1 && (
                  <Badge variant="neutral" title={t('loans.migratedHint')}>
                    {t('loans.migrated')}
                  </Badge>
                )}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {l.member_society_id && <span className="tnum font-semibold text-foreground">{l.member_society_id}</span>}
                {l.member_society_id && l.member_nic ? ' · ' : ''}
                <span className="tnum">{l.member_nic}</span>
              </div>
            </div>
          )
        }
      },
      { id: 'principal_amount', accessorKey: 'principal_amount', header: t('reports.principal'), meta: { align: 'right' }, cell: ({ getValue }) => <span className="tnum font-medium">{formatCurrency(getValue() as number)}</span> },
      {
        id: 'balance',
        accessorFn: (l) => balanceOf(l),
        header: t('loans.balanceOwed'),
        meta: { align: 'right' },
        cell: ({ row }) => {
          const l = row.original
          return (
            <div>
              <div className="tnum font-bold text-danger">{formatCurrency(balanceOf(l))}</div>
              <div className="tnum text-[11px] text-muted-foreground">
                P {formatCurrency(l.principal_owed)} · I {formatCurrency(l.interest_owed)} · F {formatCurrency(l.fines_owed)}
              </div>
            </div>
          )
        }
      },
      {
        id: 'guarantors',
        header: t('loans.guarantors'),
        enableSorting: false,
        meta: { align: 'center', width: '7rem' },
        cell: ({ row }) => (
          <Badge variant="neutral" className="gap-1">
            <ShieldCheck className="text-primary" />
            <span className="tnum font-semibold">{row.original.guarantor_count ?? 0}</span>
          </Badge>
        )
      },
      { id: 'status', accessorKey: 'status', header: t('common.status'), enableSorting: false, meta: { align: 'center' }, cell: ({ getValue }) => <StatusPill value={getValue() as string} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right', width: '7rem' },
        cell: ({ row }) => {
          const l = row.original
          return (
            <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t('loans.viewDetails')}: ${l.member_name}`} onClick={() => void navigate({ to: '/loans/$loanId', params: { loanId: l.id } })}>
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('loans.viewDetails')}</TooltipContent>
              </Tooltip>
              {isOpen(l) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-success hover:bg-success-soft hover:text-success" aria-label={`${t('loans.recordRepayment')}: ${l.member_name}`} onClick={() => setRepaying(l)}>
                      <HandCoins />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('loans.recordRepayment')}</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('loans.deletePermanently')}: ${l.member_name}`} onClick={() => setDeleting(l)}>
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('loans.deletePermanently')}</TooltipContent>
              </Tooltip>
            </div>
          )
        }
      }
    ],
    [t, lang, navigate]
  )

  return (
    <>
      <PageHeader
        title={t('nav.loans')}
        description={t('loans.subtitle')}
        actions={
          <Button onClick={() => setEntry('new')}>
            <Plus /> {migration ? t('loans.addLoan') : t('loans.issueNew')}
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('loans.searchPlaceholder')} className="pl-9" aria-label={t('common.search')} />
          </div>
          <div className="text-right leading-tight">
            <div className="text-xs text-muted-foreground">{t('loans.outstandingExposure')}</div>
            <div className="tnum text-lg font-bold text-danger">{formatCurrency(totalOwed)}</div>
          </div>
        </div>

        {loans.isError ? (
          <div className="p-6">
            <EmptyState icon={<AlertTriangle />} title={t('common.somethingWrong')} description={errorMessage(loans.error)} action={<Button onClick={() => void loans.refetch()}>{t('common.tryAgain')}</Button>} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={sorted}
            loading={loans.isPending}
            manualSorting
            sorting={sorting}
            onSortingChange={onSortingChange}
            getRowId={(l) => String(l.id)}
            onRowClick={(row) => void navigate({ to: '/loans/$loanId', params: { loanId: row.original.id } })}
            empty={<EmptyState className="m-4" icon={<HandCoins />} title={t('loans.noLoans')} action={<Button onClick={() => setEntry('new')}><Plus /> {migration ? t('loans.addLoan') : t('loans.issueNew')}</Button>} />}
          />
        )}
      </Card>

      <IssueLoanSheet open={entry === 'new'} onOpenChange={(o) => !o && setEntry(null)} loans={rows} headerSlot={migration ? <LoanKindChooser value="new" onChange={setEntry} /> : undefined} />
      <MigrateLoanSheet open={entry === 'existing'} onOpenChange={(o) => !o && setEntry(null)} loans={rows} headerSlot={<LoanKindChooser value="existing" onChange={setEntry} />} />
      <RepayLoanDialog loan={repaying} onOpenChange={(o) => !o && setRepaying(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        danger
        title={t('loans.deleteTitle')}
        description={
          <>
            {t('loans.deleteMsg', { name: deleting?.member_name ?? '' })} {Number(deleting?.is_migrated) === 1 ? t('loans.deleteMsgMigrated') : t('loans.deleteMsgNormal')}
          </>
        }
        typeToConfirm={deleting?.member_society_id ?? undefined}
        confirmLabel={t('loans.deletePermanently')}
        busy={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await remove.mutateAsync(deleting.id)
            toast.success(t('loans.deleted'))
            setDeleting(null)
          } catch (e) {
            toast.error(errorMessage(e, t('loans.deleteFailed')))
          }
        }}
      />
    </>
  )
}
