import { useEffect, useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Ban, FileDown, Plus, Printer, Receipt, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { PrintPreview } from '@/components/PrintPreview'
import { StatusPill } from '@/components/StatusPill'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useExpenseTypes, useIncomeTypes, useSettings } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { downloadCsv, toCsv } from '@/lib/format/csv'
import { formatDate, todayIso } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ledgerApiFor } from './api'
import { ExpenseFormSheet } from './components/ExpenseFormSheet'
import { IncomeFormSheet } from './components/IncomeFormSheet'
import { LedgerFilterBar } from './components/LedgerFilterBar'
import { VoidDialog } from './components/VoidDialog'
import type { LedgerSearch } from './filters'
import { useDeleteTx, useLedger, useVoidTx } from './queries'
import { expenseVoucherHtml, incomeReceiptHtml, PAYMENT_METHOD_KEY } from './receipts'
import type { ExpenseTransaction, IncomeTransaction, LedgerKind, LedgerTx } from './types'

interface LedgerPageProps {
  kind: LedgerKind
  search: LedgerSearch
  onSearchChange: (patch: Partial<LedgerSearch>) => void
}

const isIncome = (kind: LedgerKind, _tx: LedgerTx): _tx is IncomeTransaction => kind === 'income'

export function LedgerPage({ kind, search, onSearchChange }: LedgerPageProps) {
  const { t, lang } = useT()
  const income = kind === 'income'
  const page = search.page ?? 1
  const size = search.size ?? 25
  const params = { search: search.q, type_id: search.type, from: search.from, to: search.to, page, limit: size }
  const list = useLedger(kind, params)
  const settings = useSettings()
  const incomeTypes = useIncomeTypes()
  const expenseTypes = useExpenseTypes()
  const voidTx = useVoidTx(kind)
  const deleteTx = useDeleteTx(kind)

  const [formOpen, setFormOpen] = useState(false)
  const [formMember, setFormMember] = useState<number | null>(null)
  const [voidingId, setVoidingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ title: string; html: string } | null>(null)
  const [exporting, setExporting] = useState(false)

  // Record-payment handoff from Member 360: open the form pre-selected once, then clean the URL
  useEffect(() => {
    if (income && search.member) {
      setFormMember(search.member)
      setFormOpen(true)
      onSearchChange({ member: undefined })
    }
  }, [income, search.member]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quick action from the command palette: /incomes?create=1
  useEffect(() => {
    if (!search.create) return
    setFormOpen(true)
    onSearchChange({ create: undefined })
  }, [search.create]) // eslint-disable-line react-hooks/exhaustive-deps

  const societyName = settings.data?.society_name || 'eSamithi'
  const types = useMemo(() => ((income ? incomeTypes.data : expenseTypes.data) ?? []).filter((x) => Number(x.is_active) === 1).map((x) => ({ id: x.id, name: x.name })), [income, incomeTypes.data, expenseTypes.data])
  const rows = (list.data?.transactions ?? []) as LedgerTx[]
  const total = list.data?.total ?? 0
  const activeTotal = list.data?.active_total ?? 0

  const openPreview = (tx: LedgerTx) => {
    if (isIncome(kind, tx)) setPreview({ title: t('ledger.printReceipt'), html: incomeReceiptHtml(tx, societyName) })
    else setPreview({ title: t('ledger.printVoucher'), html: expenseVoucherHtml(tx as ExpenseTransaction, societyName) })
  }

  const onCreated = (tx: LedgerTx) => {
    const who = income ? (tx as IncomeTransaction).payer_name : (tx as ExpenseTransaction).recipient_name
    toast.success(income ? t('iform.recorded') : t('eform.recorded'), {
      description: who ? t('ledger.recordedFor', { name: who }) : undefined,
      action: { label: income ? t('ledger.printAfterSave') : t('ledger.voucherPrintAfterSave'), onClick: () => openPreview(tx) }
    })
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all = await ledgerApiFor(kind).all({ search: search.q, type_id: search.type, from: search.from, to: search.to })
      const headers = income
        ? [t('csv.date'), t('csv.payer'), t('csv.nic'), t('csv.type'), t('csv.method'), t('csv.wallet'), t('csv.amount'), t('csv.status'), t('csv.notes')]
        : [t('csv.date'), t('csv.recipient'), t('csv.nic'), t('csv.type'), t('csv.voucher'), t('csv.method'), t('csv.wallet'), t('csv.amount'), t('csv.status'), t('csv.notes')]
      const data = (all.transactions as LedgerTx[]).map((tx) => {
        const date = String(tx.date).slice(0, 10)
        const method = PAYMENT_METHOD_KEY[tx.payment_method] ? t(PAYMENT_METHOD_KEY[tx.payment_method]!) : tx.payment_method
        const status = tx.status === 'Active' ? t('rcpt.stActive') : t('rcpt.stVoid')
        return income
          ? [date, (tx as IncomeTransaction).payer_name ?? '', tx.member_nic ?? '', (tx as IncomeTransaction).income_type_name ?? '', method, tx.wallet_name ?? '', (tx.amount / 100).toFixed(2), status, tx.notes ?? '']
          : [date, (tx as ExpenseTransaction).recipient_name ?? '', tx.member_nic ?? '', (tx as ExpenseTransaction).expense_type_name ?? '', (tx as ExpenseTransaction).voucher_no ?? '', method, tx.wallet_name ?? '', (tx.amount / 100).toFixed(2), status, tx.notes ?? '']
      })
      downloadCsv(`${income ? 'income' : 'expense'}-ledger-${todayIso()}.csv`, toCsv(headers, data))
      toast.success(t('ledger.exported', { count: data.length }))
    } catch (e) {
      toast.error(errorMessage(e, t('ledger.exportFailed')))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo<ColumnDef<LedgerTx, unknown>[]>(
    () => [
      { accessorKey: 'date', header: t('common.date'), meta: { width: '7.5rem' }, cell: ({ getValue }) => <span className="tnum whitespace-nowrap">{formatDate(getValue() as string, lang)}</span> },
      {
        id: 'party',
        header: income ? t('ledger.payer') : t('ledger.recipient'),
        enableSorting: false,
        cell: ({ row }) => {
          const tx = row.original
          const name = income ? (tx as IncomeTransaction).payer_name : (tx as ExpenseTransaction).recipient_name
          const isMember = income ? (tx as IncomeTransaction).payer_type === 'Member' : (tx as ExpenseTransaction).recipient_type === 'Member'
          return (
            <div className="min-w-0">
              <div className="truncate font-medium">{name || '—'}</div>
              <div className="tnum truncate font-mono text-[11px] text-muted-foreground">{isMember ? tx.member_nic || '' : income ? t('ledger.guest') : t('ledger.vendor')}</div>
            </div>
          )
        }
      },
      {
        id: 'category',
        header: t('reports.category'),
        enableSorting: false,
        cell: ({ row }) => {
          const tx = row.original
          const typeName = income ? (tx as IncomeTransaction).income_type_name : (tx as ExpenseTransaction).expense_type_name
          return (
            <div className="min-w-0">
              <div>{typeName}</div>
              {tx.notes && (
                <div className="max-w-[240px] truncate text-[11px] text-muted-foreground" title={tx.notes}>
                  {tx.notes}
                </div>
              )}
            </div>
          )
        }
      },
      { accessorKey: 'payment_method', header: t('ledger.method'), cell: ({ getValue }) => { const m = getValue() as string; return <span className="text-muted-foreground">{PAYMENT_METHOD_KEY[m] ? t(PAYMENT_METHOD_KEY[m]!) : m}</span> } },
      { accessorKey: 'wallet_name', header: t('ledger.wallet'), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string) || '—'}</span> },
      {
        accessorKey: 'amount',
        header: t('common.amount'),
        meta: { align: 'right' },
        cell: ({ row }) => <span className={cn('tnum font-semibold', income ? 'text-success' : 'text-danger')}>{formatCurrency(row.original.amount)}</span>
      },
      { accessorKey: 'status', header: t('common.status'), meta: { align: 'center' }, cell: ({ getValue }) => <StatusPill value={getValue() as string} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right', width: '6rem' },
        cell: ({ row }) => {
          const tx = row.original
          return (
            <div className="flex items-center justify-end gap-0.5">
              {tx.status === 'Active' ? (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={income ? t('ledger.printReceipt') : t('ledger.printVoucher')} onClick={() => openPreview(tx)}>
                        <Printer />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{income ? t('ledger.printReceipt') : t('ledger.printVoucher')}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('ledger.voidTx')} onClick={() => setVoidingId(tx.id)}>
                        <Ban />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('ledger.voidTx')}</TooltipContent>
                  </Tooltip>
                </>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('ledger.deleteTxPermanently')} onClick={() => setDeletingId(tx.id)}>
                      <Trash2 />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('ledger.deleteTxPermanently')}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )
        }
      }
    ],
    [t, lang, income, societyName] // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <>
      <PageHeader
        title={income ? t('ledger.incomeTitle') : t('ledger.expenseTitle')}
        description={income ? t('ledger.incomeSubtitle') : t('ledger.expenseSubtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => void exportCsv()} loading={exporting}>
              <FileDown /> {t('ledger.exportCsv')}
            </Button>
            <Button onClick={() => { setFormMember(null); setFormOpen(true) }}>
              <Plus /> {income ? t('dash.recordIncome') : t('ledger.recordExpense')}
            </Button>
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          <div className="text-xs text-muted-foreground">{t('ledger.filters')}</div>
          <div className="text-right leading-tight">
            <div className="text-xs text-muted-foreground">{income ? t('ledger.totalActiveIncome') : t('ledger.totalActiveExpenses')}</div>
            <div className={cn('tnum text-lg font-semibold', income ? 'text-success' : 'text-danger')}>{formatCurrency(activeTotal)}</div>
          </div>
        </div>
        <LedgerFilterBar search={search} onChange={onSearchChange} types={types} searchPlaceholder={income ? t('ledger.searchIncome') : t('ledger.searchExpense')} />

        {list.isError ? (
          <div className="p-6">
            <EmptyState icon={<AlertTriangle />} title={t('common.somethingWrong')} description={errorMessage(list.error)} action={<Button onClick={() => void list.refetch()}>{t('common.tryAgain')}</Button>} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              loading={list.isPending}
              getRowId={(tx) => String(tx.id)}
              rowClassName={(row) => (row.original.status === 'Void' ? 'opacity-50 [&_td:not(:last-child)]:line-through' : undefined)}
              empty={<EmptyState className="m-4" icon={<Receipt />} title={t('ledger.noTransactions')} />}
            />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={size}
                total={total}
                pageSizes={[25, 50, 100]}
                summary={(s, e, tot) => t('ledger.showing', { start: s, end: e, total: tot })}
                onPageChange={(p) => onSearchChange({ page: p === 1 ? undefined : p })}
                onPageSizeChange={(n) => onSearchChange({ size: n === 25 ? undefined : (n as 50 | 100), page: undefined })}
              />
            )}
          </>
        )}
      </Card>

      {income ? (
        <IncomeFormSheet open={formOpen} onOpenChange={setFormOpen} initialMemberId={formMember} onCreated={onCreated} />
      ) : (
        <ExpenseFormSheet open={formOpen} onOpenChange={setFormOpen} onCreated={onCreated} />
      )}
      <VoidDialog
        open={voidingId !== null}
        onOpenChange={(o) => !o && setVoidingId(null)}
        busy={voidTx.isPending}
        onConfirm={async (reason) => {
          if (voidingId === null) return
          try {
            await voidTx.mutateAsync({ id: voidingId, reason })
            toast.success(income ? t('ledger.voidedIncome') : t('ledger.voidedExpense'))
            setVoidingId(null)
          } catch (e) {
            toast.error(errorMessage(e, t('ledger.voidFailed')))
          }
        }}
      />
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        danger
        title={t('ledger.deleteTitle')}
        description={t('ledger.deleteMsg')}
        confirmLabel={t('ledger.deletePermanently')}
        busy={deleteTx.isPending}
        onConfirm={async () => {
          if (deletingId === null) return
          try {
            await deleteTx.mutateAsync(deletingId)
            toast.success(t('ledger.deleted'))
            setDeletingId(null)
          } catch (e) {
            toast.error(errorMessage(e, t('ledger.deleteFailed')))
          }
        }}
      />
      <PrintPreview open={preview !== null} onOpenChange={(o) => !o && setPreview(null)} title={preview?.title ?? ''} html={preview?.html ?? null} />
    </>
  )
}
