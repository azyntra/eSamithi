import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useStatement } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Card, EmptyState, ErrorView, Screen, SkeletonCards, StaleBanner, StatusBadge, Subtitle } from '../ui'

export default function Guarantees(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const statement = useStatement()

  if (statement.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (statement.isError && !statement.data) {
    return (
      <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
        <ErrorView onRetry={() => statement.refetch()} />
      </Screen>
    )
  }

  const rows = statement.data!.guarantees

  return (
    <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
      {statement.isError && <StaleBanner />}
      <Subtitle>{t('mob.guaranteesInfo')}</Subtitle>
      {rows.length === 0 && <EmptyState icon="people-outline" text={t('mob.noGuarantees')} />}
      {rows.map((g) => (
        <Card key={g.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>{t('mob.borrower')}</Text>
              <Text style={{ color: p.text, fontSize: 16, fontWeight: '600', marginTop: 2 }}>{g.borrower_name}</Text>
              <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 2 }}>{t('mob.loanIssued', { date: formatDate(g.date_issued) })}</Text>
            </View>
            <StatusBadge status={g.status} />
          </View>
        </Card>
      ))}
    </Screen>
  )
}
