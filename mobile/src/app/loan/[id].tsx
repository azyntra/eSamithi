import React from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useLoan, useSocietyInfo } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { formatCurrency } from '../../lib/money'
import { isOpenLoan, loanOwed, repaidFraction } from '../../lib/loans'
import { Avatar, ErrorView, LoanRing, Screen, SectionTitle, SkeletonCards, StaleBanner, StatusPill, TimelineRow, useCardStyle } from '../../ui'

// One loan (redesign §6.3.2): the ring and what is still to pay lead; each
// repayment shows its split as a small table instead of a run-on line.
export default function LoanDetail(): React.ReactElement {
  const router = useRouter()
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const { id } = useLocalSearchParams<{ id: string }>()
  const loan = useLoan(parseInt(id ?? '0', 10))
  const society = useSocietyInfo()

  if (loan.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (loan.isError && !loan.data) {
    return (
      <Screen refreshing={loan.isRefetching} onRefresh={() => loan.refetch()}>
        <ErrorView onRetry={() => loan.refetch()} />
      </Screen>
    )
  }

  const d = loan.data!
  const owed = loanOwed(d)
  const open = isOpenLoan(d)
  const fraction = repaidFraction(d) ?? (open ? 0 : 1)

  const line = (icon: keyof typeof Ionicons.glyphMap, label: string, cents: number, first?: boolean, color?: string): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}>
      <Ionicons name={icon} size={20} color={p.textMuted} />
      <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
      <Text style={{ color: color ?? p.text, fontSize: typeScale.body, fontFamily: interFamily.semibold, fontVariant: ['tabular-nums'] }}>{formatCurrency(cents)}</Text>
    </View>
  )

  const split = (label: string, cents: number): React.ReactElement => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{label}</Text>
      {/* No "Rs." here: the total above already carries it, and three of them wrap */}
      <Text style={{ color: p.text, fontSize: typeScale.caption, fontFamily: interFamily.bold, fontVariant: ['tabular-nums'] }}>{formatCurrency(cents).replace(/^Rs\.\s*/, '')}</Text>
    </View>
  )

  return (
    <Screen refreshing={loan.isRefetching} onRefresh={() => loan.refetch()}>
      {loan.isError && <StaleBanner />}

      <View style={[card, { padding: spacing.lg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusPill status={d.status} />
          <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.loanIssued', { date: formatDate(d.date_issued) })}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
          <LoanRing fraction={fraction} tone={d.status === 'Overdue' ? 'danger' : 'success'} size={96} label={t('mob.repaidShort')} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.stillToPay')}</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: p.text, fontSize: typeScale.display, fontFamily: interFamily.extrabold, fontVariant: ['tabular-nums'] }}>{formatCurrency(owed)}</Text>
            <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.originalLoan', { amount: formatCurrency(d.principal_amount) })}</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          {line('cash-outline', t('mob.principal'), d.principal_owed, true)}
          {line('trending-up-outline', t('mob.interest'), d.interest_owed)}
          {line('warning-outline', t('mob.fines'), d.fines_owed, false, d.fines_owed > 0 ? p.danger : undefined)}
        </View>
        {d.is_migrated === 1 ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: spacing.md }}>
            <Ionicons name="information-circle-outline" size={18} color={p.textMuted} />
            <Text style={{ flex: 1, color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.migratedLoan')}</Text>
          </View>
        ) : null}
      </View>

      {d.guarantors.length > 0 ? (
        <>
          <SectionTitle title={t('mob.guarantors')} />
          <View style={[card, { paddingHorizontal: spacing.lg }]}>
            {d.guarantors.map((name, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}>
                <Avatar name={name} size={36} />
                <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <SectionTitle title={t('mob.repayments')} />
      <View style={[card, { paddingHorizontal: spacing.md + 2 }]}>
        {d.payments.length === 0 ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', paddingVertical: spacing.xl }}>{t('mob.noRepayments')}</Text>
        ) : null}
        {d.payments.map((pay, i) => (
          <View key={pay.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border, paddingBottom: spacing.md }}>
            <TimelineRow
              first
              date={pay.date}
              title={t('mob.repayment')}
              cents={pay.principal_paid + pay.interest_paid + pay.fines_paid}
              direction="in"
              onPress={() => router.push({ pathname: '/receipt/[kind]/[id]', params: { kind: 'loan-payment', id: String(pay.id) } })}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginLeft: 56, backgroundColor: p.surfaceAlt, borderRadius: radius.sm, padding: spacing.sm + 2 }}>
              {split(t('mob.principal'), pay.principal_paid)}
              {split(t('mob.interest'), pay.interest_paid)}
              {split(t('mob.fines'), pay.fines_paid)}
            </View>
          </View>
        ))}
      </View>

      {society.isSuccess ? (
        <>
          <SectionTitle title={t('mob.loanTerms')} />
          <View style={[card, { paddingHorizontal: spacing.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
              <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{t('mob.monthlyInterest')}</Text>
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.semibold }}>{society.data.monthly_interest_rate == null ? '—' : `${society.data.monthly_interest_rate}%`}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, borderTopWidth: 1, borderTopColor: p.border }}>
              <Text style={{ flex: 1, color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) }}>{t('mob.lateFine')}</Text>
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: interFamily.semibold }}>{society.data.late_fine_rate == null ? '—' : `${society.data.late_fine_rate}%`}</Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  )
}
