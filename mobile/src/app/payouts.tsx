import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useStatement } from '../api/hooks'
import { Card, EmptyState, ErrorView, Money, Screen, SkeletonCards, StaleBanner, StatusBadge } from '../ui'

export default function Payouts(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const statement = useStatement()

  if (statement.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (statement.isError && !statement.data) {
    return (
      <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
        <ErrorView onRetry={() => statement.refetch()} />
      </Screen>
    )
  }

  const rows = statement.data!.expenses

  return (
    <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
      {statement.isError && <StaleBanner />}
      {rows.length === 0 && <EmptyState icon="wallet-outline" text={t('mob.noBenefits')} />}
      {rows.length > 0 && (
        <Card style={{ paddingVertical: 4 }}>
          {rows.map((row, i) => (
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
                <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>{row.date}</Text>
                {row.status !== 'Active' && (
                  <View style={{ marginTop: 4 }}>
                    <StatusBadge status={row.status} />
                  </View>
                )}
              </View>
              <Money cents={row.amount} color={row.status === 'Active' ? p.success : p.textMuted} />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}
