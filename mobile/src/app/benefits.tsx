import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { spacing, type as typeScale, usePalette } from '../theme'
import { interFamily } from '../typography'
import { useBenefitsSchedule } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { Callout, EmptyState, ErrorView, ListRow, Screen, SkeletonCards, StaleBanner, useCardStyle } from '../ui'

// What the society pays out, and how much (redesign §6.6.4)
export default function Benefits(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const card = useCardStyle()
  const benefits = useBenefitsSchedule()

  if (benefits.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (benefits.isError && !benefits.data) {
    return (
      <Screen refreshing={benefits.isRefetching} onRefresh={() => benefits.refetch()}>
        <ErrorView onRetry={() => benefits.refetch()} />
      </Screen>
    )
  }

  const rows = benefits.data!
  return (
    <Screen refreshing={benefits.isRefetching} onRefresh={() => benefits.refetch()}>
      {benefits.isError && <StaleBanner />}
      <Callout icon="gift-outline" tone="brand" text={t('mob.benefitsSubtitle')} />
      {rows.length === 0 ? <EmptyState icon="gift-outline" text={t('mob.noBenefits')} /> : (
        <View style={[card, { paddingHorizontal: spacing.lg }]}>
          {rows.map((b, i) => {
            const paid = b.standard_payout > 0
            return (
            <ListRow
              key={`${b.code ?? b.name}-${i}`}
              first={i === 0}
              icon="gift-outline"
              label={b.name}
              right={
                <Text style={{ color: paid ? p.success : p.textMuted, fontSize: typeScale.body, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>
                  {paid ? formatCurrency(b.standard_payout) : '—'}
                </Text>
              }
            />
            )
          })}
        </View>
      )}
    </Screen>
  )
}
