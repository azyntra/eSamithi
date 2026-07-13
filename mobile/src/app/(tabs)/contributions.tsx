import React, { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useStatement, type LedgerRow } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { Card, EmptyState, ErrorView, Money, Screen, SectionHeader, SkeletonCards, StaleBanner, StatusBadge } from '../../ui'

// Group ledger rows by year-month, newest first (rows arrive date-desc)
function groupByMonth(rows: LedgerRow[]): Array<{ key: string; rows: LedgerRow[] }> {
  const groups: Array<{ key: string; rows: LedgerRow[] }> = []
  for (const row of rows) {
    const key = String(row.date).slice(0, 7) // YYYY-MM
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.rows.push(row)
    else groups.push({ key, rows: [row] })
  }
  return groups
}

export default function Contributions(): React.ReactElement {
  const { t, monthsLong } = useT()
  const p = usePalette()
  const statement = useStatement()

  const groups = useMemo(() => groupByMonth(statement.data?.income ?? []), [statement.data])

  if (statement.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (statement.isError && !statement.data) {
    return (
      <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
        <ErrorView onRetry={() => statement.refetch()} />
      </Screen>
    )
  }

  const total = statement.data!.income.filter((r) => r.status === 'Active').reduce((s, r) => s + r.amount, 0)

  const monthLabel = (key: string): string => {
    const [y, m] = key.split('-').map(Number)
    return `${monthsLong[(m ?? 1) - 1]} ${y}`
  }

  return (
    <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
      {statement.isError && <StaleBanner />}
      <Card>
        <Text style={{ color: p.textMuted, fontSize: 13, marginBottom: 6 }}>{t('mob.totalContributed')}</Text>
        <Money cents={total} size={22} bold color={p.success} />
      </Card>

      {groups.length === 0 && <EmptyState icon="cash-outline" text={t('mob.noContributions')} />}

      {groups.map((group) => (
        <View key={group.key}>
          <SectionHeader>{monthLabel(group.key)}</SectionHeader>
          <Card style={{ paddingVertical: 4 }}>
            {group.rows.map((row, i) => (
              <View
                key={row.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: p.border
                }}
              >
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{row.type_name}</Text>
                  <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>{formatDate(row.date)}</Text>
                  {row.status !== 'Active' && (
                    <View style={{ marginTop: 4 }}>
                      <StatusBadge status={row.status} />
                    </View>
                  )}
                </View>
                <Money cents={row.amount} color={row.status === 'Active' ? p.text : p.textMuted} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  )
}
