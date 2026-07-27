import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useStatement } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Card, EmptyState, ErrorView, Money, ScalePressable, Screen, SkeletonCards, StaleBanner, StatusBadge } from '../ui'

export default function Payouts(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
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
            <ScalePressable
              key={row.id}
              accessibilityRole="button"
              scaleTo={0.985}
              onPress={() => router.push({ pathname: '/receipt/[kind]/[id]', params: { kind: 'expense', id: String(row.id) } })}
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
              <Money cents={row.amount} color={row.status === 'Active' ? p.success : p.textMuted} />
              <Ionicons name="chevron-forward" size={16} color={p.textMuted} style={{ marginLeft: 6 }} />
            </ScalePressable>
          ))}
        </Card>
      )}
    </Screen>
  )
}
