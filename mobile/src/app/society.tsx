import React from 'react'
import { Linking, Text, View } from 'react-native'
import { useT } from '../i18n'
import { spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useSocietyInfo } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { Button, DetailRow, ErrorView, GroupLabel, LogoTile, Screen, SkeletonCards, StaleBanner, useCardStyle } from '../ui'

// About the society (redesign §6.6.6): who they are, how to reach them, the
// loan rules.
export default function Society(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const society = useSocietyInfo()

  if (society.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (society.isError && !society.data) {
    return (
      <Screen refreshing={society.isRefetching} onRefresh={() => society.refetch()}>
        <ErrorView onRetry={() => society.refetch()} />
      </Screen>
    )
  }

  const d = society.data!
  const maxLoanCents = d.max_loan_limit ? Number(d.max_loan_limit) : null
  const phone = d.society_phone?.trim()
  const address = d.society_address?.trim()

  return (
    <Screen refreshing={society.isRefetching} onRefresh={() => society.refetch()}>
      {society.isError && <StaleBanner />}
      <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
        <LogoTile size={64} />
        <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginTop: spacing.md, textAlign: 'center' }}>
          {d.society_name ?? 'Maranadhara Samithi'}
        </Text>
      </View>

      {phone || address ? (
        <>
          <GroupLabel>{t('mob.officeContact')}</GroupLabel>
          <View style={[card, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }]}>
            {phone ? <DetailRow first icon="call-outline" label={t('common.phone')} value={phone} /> : null}
            {address ? <DetailRow first={!phone} icon="location-outline" label={t('mob.address')} value={address} /> : null}
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
              {phone ? (
                <View style={{ flex: 1 }}>
                  <Button label={t('mob.callShort')} icon="call-outline" onPress={() => { Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {}) }} />
                </View>
              ) : null}
              {address ? (
                <View style={{ flex: 1 }}>
                  <Button label={t('mob.directions')} icon="navigate-outline" variant="secondary" onPress={() => { Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`).catch(() => {}) }} />
                </View>
              ) : null}
            </View>
          </View>
        </>
      ) : null}

      <GroupLabel>{t('mob.loanTerms')}</GroupLabel>
      <View style={[card, { paddingHorizontal: spacing.lg }]}>
        <DetailRow first icon="trending-up-outline" label={t('mob.monthlyInterest')} value={d.monthly_interest_rate == null ? '—' : `${d.monthly_interest_rate}%`} />
        <DetailRow icon="warning-outline" label={t('mob.lateFine')} value={d.late_fine_rate == null ? '—' : `${d.late_fine_rate}%`} />
        <DetailRow icon="wallet-outline" label={t('mob.maxLoan')} value={maxLoanCents ? formatCurrency(maxLoanCents) : '—'} />
        <DetailRow icon="people-outline" label={t('mob.reqGuarantors')} value={d.required_guarantors ?? '—'} />
      </View>
    </Screen>
  )
}
