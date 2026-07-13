import React from 'react'
import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useBenefitsSchedule } from '../api/hooks'
import { Card, EmptyText, ErrorView, Money, Screen, SkeletonCards, StaleBanner, Subtitle } from '../ui'

export default function Benefits(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const benefits = useBenefitsSchedule()

  if (benefits.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (benefits.isError && !benefits.data) {
    return (
      <Screen refreshing={benefits.isRefetching} onRefresh={() => benefits.refetch()}>
        <ErrorView onRetry={() => benefits.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen refreshing={benefits.isRefetching} onRefresh={() => benefits.refetch()}>
      {benefits.isError && <StaleBanner />}
      <Subtitle>{t('mob.benefitsSubtitle')}</Subtitle>
      {benefits.data!.length === 0 && <EmptyText>—</EmptyText>}
      <Card style={{ paddingVertical: 4 }}>
        {benefits.data!.map((b, i) => (
          <View
            key={`${b.code ?? b.name}-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 13,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: p.border
            }}
          >
            <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', flex: 1, marginRight: 10 }}>{b.name}</Text>
            {b.standard_payout > 0 ? (
              <Money cents={b.standard_payout} color={p.success} />
            ) : (
              <Text style={{ color: p.textMuted, fontSize: 14 }}>—</Text>
            )}
          </View>
        ))}
      </Card>
    </Screen>
  )
}
