import React from 'react'
import { Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useSocietyFunds, useSocietyInfo } from '../api/hooks'
import { formatDate } from '../lib/date'
import { formatCurrency } from '../lib/money'
import { AmountHero, Callout, DateBlock, ErrorView, GroupLabel, Screen, SkeletonCards, StaleBanner, useCardStyle } from '../ui'

// Society funds (redesign §6.6.7): the total on a plain card (the gradient is
// reserved for Home, the card and the primary button), a cash-vs-deposits bar
// with a legend, and each fixed deposit with its maturity date.
export default function SocietyFunds(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const funds = useSocietyFunds()
  const society = useSocietyInfo()

  if (funds.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (funds.isError && !funds.data) {
    return (
      <Screen refreshing={funds.isRefetching} onRefresh={() => funds.refetch()}>
        <ErrorView onRetry={() => funds.refetch()} />
      </Screen>
    )
  }

  const d = funds.data!
  const total = Math.max(1, d.cash_total + d.fd_total)
  const cashShare = d.cash_total / total

  const legend = (color: string, label: string, cents: number): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
      <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>{formatCurrency(cents)}</Text>
    </View>
  )

  return (
    <Screen refreshing={funds.isRefetching} onRefresh={() => funds.refetch()}>
      {funds.isError && <StaleBanner />}
      <Callout icon="eye-outline" tone="brand" text={t('mob.fundsIntro', { society: society.data?.society_name ?? 'Maranadhara Samithi' })} />

      <AmountHero icon="business-outline" label={t('mob.fundsTotal')} cents={d.total_funds} />

      <View style={[card, { padding: spacing.lg }]}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: p.border, marginBottom: spacing.md }}>
          <View style={{ flex: cashShare, backgroundColor: p.success }} />
          <View style={{ flex: 1 - cashShare, backgroundColor: p.primary }} />
        </View>
        {legend(p.success, t('mob.fundsCash'), d.cash_total)}
        {legend(p.primary, t('mob.fundsFd'), d.fd_total)}
      </View>

      <GroupLabel>{t('mob.fundsFdList')}</GroupLabel>
      <View style={[card, { paddingHorizontal: spacing.lg }]}>
        {d.fixed_deposits.length === 0 ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', paddingVertical: spacing.xl }}>{t('mob.fundsNoFd')}</Text>
        ) : d.fixed_deposits.map((fd, i) => (
          <View key={fd.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 68, paddingVertical: spacing.sm, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
            {fd.maturity_date ? <DateBlock date={fd.maturity_date} tone="brand" /> : (
              <View style={{ width: 44, height: 50, borderRadius: radius.sm + 2, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="lock-closed-outline" size={20} color={p.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{fd.bank_name || t('mob.fundsFdBank')}</Text>
              <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>
                {[fd.fd_number ? `#${fd.fd_number}` : null, fd.interest_rate != null ? `${fd.interest_rate}%` : null, fd.maturity_date ? t('mob.fundsMatures', { date: formatDate(fd.maturity_date) }) : null].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>{formatCurrency(fd.principal)}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro), textAlign: 'center', marginTop: spacing.md }}>{t('mob.fundsNote')}</Text>
    </Screen>
  )
}
