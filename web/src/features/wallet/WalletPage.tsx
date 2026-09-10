import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ArrowRightLeft, Box, CalendarClock, Landmark, Pencil, PiggyBank, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMigrationMode } from '@/features/settings/queries'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency, formatNumber } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { FixedDeposit, PhysicalAsset, Wallet } from './api'
import { AssetDialog } from './components/AssetDialog'
import { DepositDialog } from './components/DepositDialog'
import { FixedDepositFormSheet } from './components/FixedDepositFormSheet'
import { TransferDialog } from './components/TransferDialog'
import { WalletFormSheet } from './components/WalletFormSheet'
import { fdDisplayStatus, isNearingMaturity } from './fd'
import { useAssets, useDeleteAsset, useDeleteWallet, useFixedDeposits, useToggleWallet, useWallets, useWithdrawFixedDeposit } from './queries'

import type { WalletTab } from './tabs'
export type { WalletTab }

export function WalletPage({ tab, onTabChange }: { tab: WalletTab; onTabChange: (tab: WalletTab) => void }) {
  const { t, lang } = useT()
  const wallets = useWallets()
  const fds = useFixedDeposits()
  const assets = useAssets()
  const migration = useMigrationMode() === true
  const toggle = useToggleWallet()
  const removeWallet = useDeleteWallet()
  const withdraw = useWithdrawFixedDeposit()
  const removeAsset = useDeleteAsset()

  const [walletOpen, setWalletOpen] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const [fdOpen, setFdOpen] = useState(false)
  const [depositTarget, setDepositTarget] = useState<Wallet | null>(null)
  const [assetTarget, setAssetTarget] = useState<PhysicalAsset | null | undefined>(undefined)
  const [deletingWallet, setDeletingWallet] = useState<Wallet | null>(null)
  const [withdrawing, setWithdrawing] = useState<FixedDeposit | null>(null)
  const [deletingAsset, setDeletingAsset] = useState<PhysicalAsset | null>(null)

  const walletRows = wallets.data ?? []
  const fdRows = fds.data ?? []
  const assetRows = assets.data ?? []
  const totalLiquid = walletRows.filter((w) => Number(w.is_active) === 1).reduce((s, w) => s + w.balance, 0)
  const totalFD = fdRows.filter((f) => f.status === 'Active').reduce((s, f) => s + (f.principal || 0), 0)

  const onToggle = async (w: Wallet) => {
    if (Number(w.is_active) === 1 && w.balance > 0) return toast.error(t('wallet.cannotDeactivateToast'))
    try {
      await toggle.mutateAsync(w.id)
      toast.success(t('wallet.statusUpdated'))
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const walletColumns = useMemo<ColumnDef<Wallet, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('wallet.walletName'), cell: ({ row }) => <span className={cn('font-medium', Number(row.original.is_active) === 0 && 'text-muted-foreground')}>{row.original.name}</span> },
      { accessorKey: 'wallet_type', header: t('wallet.type'), cell: ({ getValue }) => <StatusPill value={getValue() as string} /> },
      { accessorKey: 'balance', header: t('wallet.balance'), meta: { align: 'right' }, cell: ({ row }) => <span className={cn('tnum font-semibold', row.original.balance > 0 && 'text-success')}>{formatCurrency(row.original.balance)}</span> },
      { accessorKey: 'is_active', header: t('common.status'), meta: { align: 'center' }, cell: ({ row }) => <StatusPill value={Number(row.original.is_active) === 1 ? 'Active' : 'Inactive'} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => {
          const w = row.original
          const active = Number(w.is_active) === 1
          const hasFunds = w.balance > 0
          return (
            <div className="flex items-center justify-end gap-1">
              {active && migration && (
                <Button size="sm" variant="secondary" onClick={() => setDepositTarget(w)} title={t('wallet.depositHint')}>
                  <Plus /> {t('wallet.deposit')}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => void onToggle(w)} disabled={toggle.isPending}>
                {active ? t('wallet.deactivate') : t('wallet.activate')}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className={cn('text-danger hover:bg-danger-soft hover:text-danger', hasFunds && 'opacity-50')}
                      aria-label={hasFunds ? t('wallet.cannotDeleteBalance') : t('wallet.deleteWallet')}
                      onClick={() => (hasFunds ? toast.error(t('wallet.cannotDeleteBalanceToast')) : setDeletingWallet(w))}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{hasFunds ? t('wallet.cannotDeleteBalance') : t('wallet.deleteWallet')}</TooltipContent>
              </Tooltip>
            </div>
          )
        }
      }
    ],
    [t, migration, toggle.isPending] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fdColumns = useMemo<ColumnDef<FixedDeposit, unknown>[]>(
    () => [
      { accessorKey: 'fd_number', header: t('reports.fdNumber'), cell: ({ getValue }) => <span className="font-mono font-medium">{getValue() as string}</span> },
      { accessorKey: 'bank_name', header: t('reports.bank') },
      { accessorKey: 'principal', header: t('reports.principal'), meta: { align: 'right' }, cell: ({ getValue }) => <span className="tnum font-semibold">{formatCurrency(getValue() as number)}</span> },
      { accessorKey: 'interest_rate', header: t('wallet.rate'), meta: { align: 'right' }, cell: ({ getValue }) => <span className="tnum">{getValue() as number}%</span> },
      {
        accessorKey: 'maturity_date',
        header: t('reports.maturityDate'),
        cell: ({ row }) => {
          const nearing = row.original.status === 'Active' && isNearingMaturity(row.original.maturity_date)
          return (
            <span className={cn('tnum inline-flex items-center gap-1.5 whitespace-nowrap', nearing && 'font-semibold text-warning')} title={nearing ? t('wallet.maturingSoon') : undefined}>
              {nearing && <CalendarClock className="size-4" />}
              {formatDate(row.original.maturity_date, lang)}
            </span>
          )
        }
      },
      {
        id: 'status',
        header: t('common.status'),
        meta: { align: 'center' },
        cell: ({ row }) => {
          const s = fdDisplayStatus(row.original)
          return (
            <span title={s === 'Matured' ? t('wallet.maturedHint') : undefined}>
              <StatusPill value={s} />
            </span>
          )
        }
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) =>
          row.original.status !== 'Withdrawn' ? (
            <Button size="sm" variant="outline" title={row.original.linked_wallet_id ? t('wallet.withdrawLinkedHint') : t('wallet.withdrawNoLinkHint')} onClick={() => setWithdrawing(row.original)}>
              {t('wallet.withdraw')}
            </Button>
          ) : null
      }
    ],
    [t, lang]
  )

  const assetColumns = useMemo<ColumnDef<PhysicalAsset, unknown>[]>(
    () => [
      { accessorKey: 'name', header: t('wallet.assetName'), cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
      { accessorKey: 'quantity', header: t('wallet.quantity'), meta: { align: 'center' }, cell: ({ getValue }) => <span className="tnum font-semibold">{formatNumber(getValue() as number)}</span> },
      { accessorKey: 'description', header: t('wallet.descriptionCondition'), enableSorting: false, cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) || '—'}</span> },
      { id: 'status', header: t('common.status'), meta: { align: 'center' }, cell: ({ row }) => <StatusPill value={Number(row.original.is_active) === 1 ? 'Active' : 'Inactive'} /> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right' },
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-0.5">
            <Button size="icon-sm" variant="ghost" aria-label={t('wallet.editAsset')} onClick={() => setAssetTarget(row.original)}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('wallet.deleteAsset')} onClick={() => setDeletingAsset(row.original)}>
              <Trash2 />
            </Button>
          </div>
        )
      }
    ],
    [t]
  )

  const primaryAction = tab === 'liquid' ? (
    <Button onClick={() => setWalletOpen(true)}>
      <Plus /> {t('wallet.newWallet')}
    </Button>
  ) : tab === 'investments' ? (
    <Button onClick={() => setFdOpen(true)}>
      <Plus /> {t('wallet.newInvestment')}
    </Button>
  ) : (
    <Button onClick={() => setAssetTarget(null)}>
      <Plus /> {t('wallet.newAsset')}
    </Button>
  )

  return (
    <>
      <PageHeader
        title={t('nav.wallet')}
        description={t('wallet.subtitle')}
        actions={
          <>
            {tab === 'liquid' && (
              <Button variant="secondary" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft /> {t('wallet.transfer')}
              </Button>
            )}
            {primaryAction}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <button type="button" className="text-left" onClick={() => onTabChange('liquid')}>
          <StatCard index={0} loading={wallets.isPending} label={t('wallet.liquidCash')} value={formatCurrency(totalLiquid)} hint={t('wallet.totalWallets', { count: walletRows.length })} icon={<PiggyBank />} tone="success" className={cn(tab === 'liquid' && 'ring-2 ring-primary/30')} />
        </button>
        <button type="button" className="text-left" onClick={() => onTabChange('investments')}>
          <StatCard index={1} loading={fds.isPending} label={t('dash.investedCapital')} value={formatCurrency(totalFD)} hint={t('wallet.activeFDs', { count: fdRows.filter((f) => f.status === 'Active').length })} icon={<Landmark />} tone="info" className={cn(tab === 'investments' && 'ring-2 ring-primary/30')} />
        </button>
        <button type="button" className="text-left" onClick={() => onTabChange('assets')}>
          <StatCard index={2} loading={assets.isPending} label={t('wallet.physicalAssets')} value={t('wallet.items', { count: assetRows.length })} hint={t('wallet.inventoryDesc')} icon={<Box />} tone="warning" className={cn(tab === 'assets' && 'ring-2 ring-primary/30')} />
        </button>
      </div>

      <Tabs value={tab} onValueChange={(v) => onTabChange(v as WalletTab)}>
        <TabsList>
          <TabsTrigger value="liquid">
            <WalletIcon /> {t('wallet.liquidWallets')}
          </TabsTrigger>
          <TabsTrigger value="investments">
            <Landmark /> {t('dash.fixedDeposits')}
          </TabsTrigger>
          <TabsTrigger value="assets">
            <Box /> {t('wallet.societyAssets')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="liquid">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('wallet.operationalWallets')}</div>
                <div className="text-xs text-muted-foreground">{t('wallet.operationalDesc')}</div>
              </div>
              <Badge variant="default">{t('wallet.totalWallets', { count: walletRows.length })}</Badge>
            </div>
            <DataTable columns={walletColumns} data={walletRows} loading={wallets.isPending} getRowId={(w) => String(w.id)} rowClassName={(r) => (Number(r.original.is_active) === 0 ? 'opacity-60' : undefined)} empty={<EmptyState className="m-4" icon={<WalletIcon />} title={t('wallet.noWallets')} action={<Button onClick={() => setWalletOpen(true)}><Plus /> {t('wallet.newWallet')}</Button>} />} />
          </Card>
        </TabsContent>

        <TabsContent value="investments">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('wallet.investmentPortfolio')}</div>
                <div className="text-xs text-muted-foreground">{t('wallet.investmentDesc')}</div>
              </div>
              <Badge variant="default">{t('wallet.activeFDs', { count: fdRows.filter((f) => f.status === 'Active').length })}</Badge>
            </div>
            <DataTable columns={fdColumns} data={fdRows} loading={fds.isPending} getRowId={(f) => String(f.id)} rowClassName={(r) => (r.original.status === 'Active' && isNearingMaturity(r.original.maturity_date) ? 'bg-warning-soft/40' : r.original.status === 'Withdrawn' ? 'opacity-60' : undefined)} empty={<EmptyState className="m-4" icon={<Landmark />} title={t('wallet.noFDs')} action={<Button onClick={() => setFdOpen(true)}><Plus /> {t('wallet.newInvestment')}</Button>} />} />
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{t('wallet.inventoryAssets')}</div>
                <div className="text-xs text-muted-foreground">{t('wallet.inventoryDesc')}</div>
              </div>
            </div>
            <DataTable columns={assetColumns} data={assetRows} loading={assets.isPending} getRowId={(a) => String(a.id)} empty={<EmptyState className="m-4" icon={<Box />} title={t('wallet.noAssets')} action={<Button onClick={() => setAssetTarget(null)}><Plus /> {t('wallet.newAsset')}</Button>} />} />
          </Card>
        </TabsContent>
      </Tabs>

      <WalletFormSheet open={walletOpen} onOpenChange={setWalletOpen} allowOpeningBalance={migration} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} wallets={walletRows} loading={wallets.isPending} />
      <DepositDialog wallet={depositTarget} onOpenChange={(o) => !o && setDepositTarget(null)} />
      <FixedDepositFormSheet open={fdOpen} onOpenChange={setFdOpen} wallets={walletRows} migrationMode={migration} walletsLoading={wallets.isPending} />
      <AssetDialog asset={assetTarget} onOpenChange={(o) => !o && setAssetTarget(undefined)} />

      <ConfirmDialog
        open={deletingWallet !== null}
        onOpenChange={(o) => !o && setDeletingWallet(null)}
        danger
        title={t('wallet.deleteWalletTitle')}
        description={t('wallet.deleteWalletMsg', { name: deletingWallet?.name ?? '' })}
        confirmLabel={t('wallet.deleteWalletLabel')}
        busy={removeWallet.isPending}
        onConfirm={async () => {
          if (!deletingWallet) return
          try {
            await removeWallet.mutateAsync(deletingWallet.id)
            toast.success(t('wallet.deletedToast', { name: deletingWallet.name }))
            setDeletingWallet(null)
          } catch (e) {
            toast.error(errorMessage(e, t('wallet.deleteFailed')))
          }
        }}
      />
      <ConfirmDialog
        open={withdrawing !== null}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title={t('wallet.withdrawFdTitle')}
        description={withdrawing ? t(withdrawing.linked_wallet_id ? 'wallet.withdrawFdMsgLinked' : 'wallet.withdrawFdMsgUnlinked', { number: withdrawing.fd_number, amount: formatCurrency(withdrawing.principal) }) : ''}
        confirmLabel={t('wallet.withdrawFdLabel')}
        busy={withdraw.isPending}
        onConfirm={async () => {
          if (!withdrawing) return
          try {
            await withdraw.mutateAsync(withdrawing.id)
            toast.success(t('wallet.fdWithdrawn'))
            setWithdrawing(null)
          } catch (e) {
            toast.error(errorMessage(e, t('wallet.fdWithdrawFailed')))
          }
        }}
      />
      <ConfirmDialog
        open={deletingAsset !== null}
        onOpenChange={(o) => !o && setDeletingAsset(null)}
        danger
        title={t('wallet.deleteAssetTitle')}
        description={t('wallet.deleteAssetMsg', { name: deletingAsset?.name ?? '' })}
        confirmLabel={t('wallet.deleteAssetLabel')}
        busy={removeAsset.isPending}
        onConfirm={async () => {
          if (!deletingAsset) return
          try {
            await removeAsset.mutateAsync(deletingAsset.id)
            toast.success(t('wallet.assetDeleted', { name: deletingAsset.name }))
            setDeletingAsset(null)
          } catch (e) {
            toast.error(errorMessage(e, t('wallet.assetDeleteFailed')))
          }
        }}
      />
    </>
  )
}
