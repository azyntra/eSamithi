import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useStatement } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Avatar, Callout, EmptyState, ErrorView, Screen, SkeletonCards, StaleBanner, StatusPill, useCardStyle } from '../ui'

// Loans I have guaranteed (redesign §6.6.5)
export default function Guarantees(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
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
      <Callout icon="people-outline" tone="brand" text={t('mob.guaranteesInfo')} />
      {rows.length === 0 ? <EmptyState icon="people-outline" text={t('mob.noGuarantees')} /> : (
        <View style={[card, { paddingHorizontal: spacing.lg }]}>
          {rows.map((g, i) => (
            <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
              <Avatar name={g.borrower_name} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{g.borrower_name}</Text>
                <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.loanIssued', { date: formatDate(g.date_issued) })}</Text>
              </View>
              <StatusPill status={g.status} />
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}
