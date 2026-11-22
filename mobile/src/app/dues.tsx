import React from 'react'
import { Linking, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useDues, useSocietyInfo } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { loanOwed } from '../lib/loans'
import { AmountHero, Button, ErrorView, ScalePressable, Screen, SectionTitle, SkeletonCards, StaleBanner, useCardStyle } from '../ui'

// "What exactly do I owe, and how do I pay it?" (redesign §6.3.1)
export default function Dues(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const dues = useDues()
  const society = useSocietyInfo()
  const card = useCardStyle()

  if (dues.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (dues.isError && !dues.data) {
    return (
      <Screen refreshing={dues.isRefetching} onRefresh={() => dues.refetch()}>
        <ErrorView onRetry={() => dues.refetch()} />
      </Screen>
    )
  }

  const d = dues.data!
  const totalDue = d.overdue_loans.reduce((s, l) => s + loanOwed(l), 0)
  const feeDue = d.membership_fee_paid === false
  const allClear = d.overdue_loans.length === 0 && !feeDue
  const phone = society.data?.society_phone?.trim()
  const address = society.data?.society_address?.trim()

  const amountRow = (icon: keyof typeof Ionicons.glyphMap, label: string, cents: number, first?: boolean, color?: string): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}>
      <Ionicons name={icon} size={20} color={p.textMuted} />
      <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
      <Text style={{ color: color ?? p.text, fontSize: typeScale.body, fontFamily: interFamily.semibold, fontVariant: ['tabular-nums'] }}>{formatCurrency(cents)}</Text>
    </View>
  )

  return (
    <Screen refreshing={dues.isRefetching} onRefresh={() => dues.refetch()}>
      {dues.isError && <StaleBanner />}

      {allClear ? (
        <View style={[card, { alignItems: 'center', padding: spacing.xl }]}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-done" size={32} color={p.success} />
          </View>
          <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginTop: spacing.md, textAlign: 'center' }}>{t('mob.statusOk')}</Text>
          <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center' }}>{t('mob.allClearSub')}</Text>
        </View>
      ) : null}

      {d.overdue_loans.length > 0 ? (
        <>
          <AmountHero icon="alert-circle-outline" tone="danger" label={t('mob.totalOverdue')} cents={totalDue} sub={t('mob.onLoans', { n: d.overdue_loans.length })} />
          <SectionTitle title={t('mob.moneyLoans')} />
          {d.overdue_loans.map((loan) => (
            <View key={loan.id} style={[card, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.md }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
                <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{t('mob.loanNum', { id: loan.id })}</Text>
                <ScalePressable accessibilityRole="link" onPress={() => router.push(`/loan/${loan.id}`)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  <Text style={{ color: p.primary, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.viewLoan')}</Text>
                  <Ionicons name="chevron-forward" size={16} color={p.primary} />
                </ScalePressable>
              </View>
              {amountRow('cash-outline', t('mob.principal'), loan.principal_owed)}
              {amountRow('trending-up-outline', t('mob.interest'), loan.interest_owed)}
              {amountRow('warning-outline', t('mob.fines'), loan.fines_owed, false, loan.fines_owed > 0 ? p.danger : undefined)}
            </View>
          ))}
        </>
      ) : null}

      {feeDue ? (
        <>
          <SectionTitle title={t('mob.membershipFee')} />
          <View style={[card, { padding: spacing.lg, flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md }]}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.warningBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="time-outline" size={20} color={p.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{t('mob.statusFeeDue')}</Text>
              <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.membershipFeeDue')}</Text>
            </View>
          </View>
        </>
      ) : null}

      {!allClear ? (
        <>
          <SectionTitle title={t('mob.howToPay')} />
          <View style={[card, { padding: spacing.lg }]}>
            <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{t('mob.howToPayBody')}</Text>
            {address ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: spacing.md }}>
                <Ionicons name="location-outline" size={18} color={p.textMuted} />
                <Text style={{ flex: 1, color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{address}</Text>
              </View>
            ) : null}
            {phone ? (
              <View style={{ marginTop: spacing.md }}>
                <Button label={t('mob.callOffice')} icon="call-outline" onPress={() => { Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {}) }} />
              </View>
            ) : null}
          </View>
        </>
      ) : null}
    </Screen>
  )
}
