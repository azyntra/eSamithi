import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, HandCoins, Landmark, RefreshCw, Users, Wallet } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api/client'
import { errorMessage } from '@/lib/api/errors'
import { useSession } from '@/lib/api/session'
import { formatCurrency, formatNumber } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { DashboardStats } from './types'

export function DashboardPage() {
  const { t, lang } = useT()
  const { user } = useSession()
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard/stats'),
    staleTime: 60_000,
    refetchInterval: 60_000
  })

  const attention = data?.attention
  const attentionItems = attention
    ? [
        { count: attention.overdueLoans, label: t('dash.overdueLoansItem') },
        { count: attention.fdsMaturingSoon, label: t('dash.fdsMaturingItem') },
        ...(attention.membersWithoutFee === null ? [] : [{ count: attention.membersWithoutFee, label: t('dash.withoutFeeItem') }])
      ].filter((i) => i.count > 0)
    : []

  return (
    <>
      <PageHeader
        title={t('dash.title')}
        description={user ? t('dash.welcome', { name: user.full_name.split(' ')[0] || user.username }) : undefined}
        actions={
          <Button variant="secondary" size="sm" onClick={() => void refetch()} loading={isFetching && !isPending}>
            <RefreshCw /> {t('dash.refresh')}
          </Button>
        }
      />

      {isError ? (
        <EmptyState icon={<AlertTriangle />} title={t('common.somethingWrong')} description={errorMessage(error)} action={<Button onClick={() => void refetch()}>{t('common.tryAgain')}</Button>} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard index={0} loading={isPending} label={t('dash.activeMembers')} value={formatNumber(data?.totalMembers)} hint={t('dash.fullyRegistered')} icon={<Users />} tone="brand" />
            <StatCard index={1} loading={isPending} label={t('dash.totalLiquid')} value={formatCurrency(data?.totalLiquid)} hint={t('dash.activeWallets')} icon={<Wallet />} tone="success" />
            <StatCard index={2} loading={isPending} label={t('dash.fixedDeposits')} value={formatCurrency(data?.totalFDs)} hint={t('dash.investedCapital')} icon={<Landmark />} tone="info" />
            <StatCard
              index={3}
              loading={isPending}
              label={t('dash.loansOutstanding')}
              value={formatCurrency(data?.totalLoansOwed)}
              hint={data?.activeLoansCount !== undefined ? t('sidebar.activeLoans', { count: data.activeLoansCount }) : t('dash.collectibles')}
              icon={<HandCoins />}
              tone="warning"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {attentionItems.length ? <AlertTriangle className="size-4 text-warning" /> : <CheckCircle2 className="size-4 text-success" />}
                  {t('dash.attentionNeeded')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isPending ? (
                  <div className="grid gap-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                  </div>
                ) : attentionItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('dash.allClear')}</p>
                ) : (
                  <ul className="grid gap-2">
                    {attentionItems.map((item) => (
                      <li key={item.label} className="flex items-center gap-3 text-sm">
                        <span className="tnum grid min-w-9 place-items-center rounded-md bg-warning-soft px-2 py-1 text-[13px] font-semibold text-warning">{formatNumber(item.count)}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {attentionItems.length > 0 && (
                  <Button asChild variant="link" size="sm" className="mt-3 h-auto px-0">
                    <Link to="/reports">{t('dash.openArrears')} →</Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('dash.recentActivity')}</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                {isPending ? (
                  <div className="grid gap-3 px-5">
                    {[0, 1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : !data?.recentActivity?.length ? (
                  <p className="px-5 text-sm text-muted-foreground">{t('dash.noActivity')}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.recentActivity.slice(0, 8).map((row, i) => {
                      const income = row.type === 'Income'
                      return (
                        <li key={`${row.date}-${i}`} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                          <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', income ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}>
                            {income ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{row.name}</div>
                            <div className="text-xs text-muted-foreground">{formatDate(row.date, lang)}</div>
                          </div>
                          <Badge variant={income ? 'success' : 'danger'} className="hidden sm:inline-flex">
                            {income ? t('common.income') : t('common.expense')}
                          </Badge>
                          <span className={cn('tnum font-semibold', income ? 'text-success' : 'text-danger')}>
                            {income ? '+' : '−'}
                            {formatCurrency(row.amount)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
