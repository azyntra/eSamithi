import React, { useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { spacing, type as typeScale, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useDues, useStatement, type LedgerRow, type StatementLoan } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { formatCurrency } from '../../lib/money'
import { isOpenLoan, loanOwed, repaidFraction } from '../../lib/loans'
import {
  AlertBanner,
  EmptyState,
  ErrorView,
  ListScreen,
  LoanRing,
  PageTitle,
  ScalePressable,
  Screen,
  SegmentedTabs,
  SkeletonCards,
  StaleBanner,
  StatTile,
  StatusPill,
  TimelineRow,
  useCardStyle,
  useListCardEdge
} from '../../ui'

// My Money (redesign §6.3): everything a member has paid, owes and received,
// in one tab. Contributions, Loans and Payouts were three separate places.

type View_ = 'contributions' | 'loans' | 'payouts'

type Item =
  | { kind: 'year'; key: string; year: string; total: number }
  | { kind: 'month'; key: string; label: string }
  | { kind: 'row'; key: string; row: LedgerRow; first: boolean; last: boolean; direction: 'in' | 'out' }
  | { kind: 'loan'; key: string; loan: StatementLoan }
  | { kind: 'closedToggle'; key: string; count: number }

const VIEWS: View_[] = ['contributions', 'loans', 'payouts']

function ledgerItems(rows: LedgerRow[], monthsLong: string[], direction: 'in' | 'out', withYears: boolean): Item[] {
  const items: Item[] = []
  // rows arrive newest first
  const yearTotals = new Map<string, number>()
  for (const r of rows) {
    if (r.status !== 'Active') continue
    const y = String(r.date).slice(0, 4)
    yearTotals.set(y, (yearTotals.get(y) ?? 0) + r.amount)
  }
  let year = ''
  let month = ''
  rows.forEach((row, i) => {
    const y = String(row.date).slice(0, 4)
    const ym = String(row.date).slice(0, 7)
    if (withYears && y !== year) {
      year = y
      items.push({ kind: 'year', key: `y${y}`, year: y, total: yearTotals.get(y) ?? 0 })
    }
    const newMonth = ym !== month
    if (newMonth) {
      month = ym
      const m = Number(ym.slice(5, 7))
      items.push({ kind: 'month', key: `m${ym}`, label: `${monthsLong[m - 1] ?? ''} ${y}` })
    }
    const next = rows[i + 1]
    const last = !next || String(next.date).slice(0, 7) !== ym
    items.push({ kind: 'row', key: `r${row.id}`, row, first: newMonth, last, direction })
  })
  return items
}

export default function MyMoney(): React.ReactElement {
  const { t, monthsLong } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const params = useLocalSearchParams<{ view?: string }>()
  const [view, setView] = useState<View_>(VIEWS.includes(params.view as View_) ? (params.view as View_) : 'contributions')
  const [showClosed, setShowClosed] = useState(false)
  const statement = useStatement()
  const dues = useDues()
  const card = useCardStyle()
  const edge = useListCardEdge()

  const refreshing = statement.isRefetching || dues.isRefetching
  const onRefresh = (): void => {
    statement.refetch()
    dues.refetch()
  }

  const items: Item[] = useMemo(() => {
    const s = statement.data
    if (!s) return []
    if (view === 'contributions') return ledgerItems(s.income, monthsLong, 'in', true)
    if (view === 'payouts') return ledgerItems(s.expenses, monthsLong, 'out', false)
    const open = s.loans.filter(isOpenLoan)
    const closed = s.loans.filter((l) => !isOpenLoan(l))
    const out: Item[] = open.map((loan) => ({ kind: 'loan', key: `l${loan.id}`, loan }))
    if (closed.length > 0) {
      out.push({ kind: 'closedToggle', key: 'closed', count: closed.length })
      if (showClosed) out.push(...closed.map((loan): Item => ({ kind: 'loan', key: `l${loan.id}`, loan })))
    }
    return out
  }, [statement.data, view, monthsLong, showClosed])

  if (statement.isPending) {
    return (
      <Screen>
        <PageTitle title={t('mob.tabMoney')} />
        <SkeletonCards cards={3} />
      </Screen>
    )
  }
  if (statement.isError && !statement.data) {
    return (
      <Screen refreshing={refreshing} onRefresh={onRefresh}>
        <PageTitle title={t('mob.tabMoney')} />
        <ErrorView onRetry={onRefresh} />
      </Screen>
    )
  }

  const s = statement.data!
  const contributed = s.income.filter((r) => r.status === 'Active').reduce((sum, r) => sum + r.amount, 0)
  const openLoans = s.loans.filter(isOpenLoan)
  const owed = openLoans.reduce((sum, l) => sum + loanOwed(l), 0)
  const overdue = dues.data?.overdue_loans ?? []
  const overdueTotal = overdue.reduce((sum, l) => sum + loanOwed(l), 0)
  const feeDue = dues.data?.membership_fee_paid === false

  const header = (
    <View>
      <PageTitle title={t('mob.tabMoney')} />
      {(statement.isError || dues.isError) && <StaleBanner />}
      {overdue.length > 0 ? (
        <AlertBanner
          tone="danger"
          icon="alert-circle-outline"
          title={t('mob.statusOverdue', { amount: formatCurrency(overdueTotal) })}
          sub={t('mob.statusOverdueSub', { n: overdue.length })}
          onPress={() => router.push('/dues')}
        />
      ) : feeDue ? (
        <AlertBanner tone="warning" icon="time-outline" title={t('mob.statusFeeDue')} sub={t('mob.statusFeeDueSub')} onPress={() => router.push('/dues')} />
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
        <StatTile icon="arrow-down-circle-outline" tone="success" label={t('mob.totalContributed')} cents={contributed} amountColor={p.success} />
        <StatTile icon="wallet-outline" label={t('mob.loanOwed')} cents={owed} sub={openLoans.length > 0 ? t('mob.onLoans', { n: openLoans.length }) : undefined} />
      </View>
      <SegmentedTabs<View_>
        options={[
          { value: 'contributions', label: t('mob.moneyContrib') },
          { value: 'loans', label: t('mob.moneyLoans') },
          { value: 'payouts', label: t('mob.moneyPayouts') }
        ]}
        value={view}
        onChange={setView}
      />
      <View style={{ height: spacing.md }} />
    </View>
  )

  const empty =
    view === 'contributions' ? <EmptyState icon="arrow-down-circle-outline" text={t('mob.noContribYet')} />
    : view === 'loans' ? <EmptyState icon="wallet-outline" text={t('mob.noLoansYet')} />
    : <EmptyState icon="arrow-up-circle-outline" text={t('mob.noPayoutsYet')} />

  const renderItem = (item: Item): React.ReactElement => {
    switch (item.kind) {
      case 'year':
        return (
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.xs, paddingHorizontal: spacing.xs }}>
            <Text style={{ color: p.text, fontSize: typeScale.heading, fontFamily: interFamily.extrabold }}>{item.year}</Text>
            <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>
              {t('mob.yearTotal', { amount: formatCurrency(item.total), year: item.year })}
            </Text>
          </View>
        )
      case 'month':
        return (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.sm, marginBottom: spacing.xs + 2, marginLeft: spacing.xs }}>
            {item.label}
          </Text>
        )
      case 'row': {
        const { row } = item
        const kind = item.direction === 'in' ? 'income' : 'expense'
        return (
          <View style={edge(item.first, item.last)}>
            <TimelineRow
              first={item.first}
              date={row.date}
              title={row.type_name}
              cents={row.amount}
              direction={row.status === 'Active' ? item.direction : undefined}
              muted={row.status !== 'Active'}
              status={row.status !== 'Active' ? <StatusPill status={row.status} /> : undefined}
              onPress={() => router.push({ pathname: '/receipt/[kind]/[id]', params: { kind, id: String(row.id) } })}
            />
          </View>
        )
      }
      case 'closedToggle':
        return (
          <ScalePressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showClosed }}
            onPress={() => setShowClosed((v) => !v)}
            style={{ minHeight: 52, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: p.borderStrong, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}
          >
            <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.repaidLoans', { n: item.count })}</Text>
            <Ionicons name={showClosed ? 'chevron-up' : 'chevron-down'} size={16} color={p.textMuted} />
          </ScalePressable>
        )
      case 'loan': {
        const { loan } = item
        const open = isOpenLoan(loan)
        const fraction = repaidFraction(loan) ?? (open ? 0 : 1)
        const left = loanOwed(loan)
        const paid = Math.max(0, loan.principal_amount - loan.principal_owed)
        return (
          <ScalePressable
            accessibilityRole="button"
            onPress={() => router.push(`/loan/${loan.id}`)}
            scaleTo={0.98}
            style={[card, { padding: spacing.lg, marginBottom: spacing.md }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <StatusPill status={loan.status} />
              <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>
                {t('mob.loanIssued', { date: formatDate(loan.date_issued) })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md }}>
              <LoanRing fraction={fraction} tone={loan.status === 'Overdue' ? 'danger' : 'success'} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.stillToPay')}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ color: p.text, fontSize: typeScale.title, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(left)}
                </Text>
                <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>
                  {t('mob.repaidOf', { paid: formatCurrency(paid), total: formatCurrency(loan.principal_amount) })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
            </View>
          </ScalePressable>
        )
      }
    }
  }

  return (
    <ListScreen<Item>
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      header={header}
      empty={empty}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  )
}
