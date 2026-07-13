import React from 'react'
import { Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useLoan, useSocietyInfo } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { repaidFraction } from '../(tabs)/loans'
import { Card, EmptyText, ErrorView, Money, ProgressBar, Row, Screen, SectionHeader, SkeletonCards, StaleBanner, StatusBadge } from '../../ui'

export default function LoanDetail(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
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
  const owed = d.principal_owed + d.interest_owed + d.fines_owed
  const fraction = repaidFraction(d)

  return (
    <Screen refreshing={loan.isRefetching} onRefresh={() => loan.refetch()}>
      {loan.isError && <StaleBanner />}
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <StatusBadge status={d.status} />
          <Text style={{ color: p.textMuted, fontSize: 13 }}>{t('mob.loanIssued', { date: formatDate(d.date_issued) })}</Text>
        </View>
        {d.is_migrated === 1 && (
          <Text style={{ color: p.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: 8 }}>{t('mob.migratedLoan')}</Text>
        )}
        <Row label={t('mob.originalAmount')} value={<Money cents={d.principal_amount} />} />
        <Row label={t('mob.principal')} value={<Money cents={d.principal_owed} />} />
        <Row label={t('mob.interest')} value={<Money cents={d.interest_owed} color={d.interest_owed > 0 ? p.warning : undefined} />} />
        <Row label={t('mob.fines')} value={<Money cents={d.fines_owed} color={d.fines_owed > 0 ? p.danger : undefined} />} />
        <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: 4 }}>
          <Row label={t('mob.totalOwed')} value={<Money cents={owed} bold size={17} color={owed > 0 ? p.warning : p.success} />} bold />
        </View>
        {(d.status === 'Active' || d.status === 'Overdue') && fraction !== null && (
          <>
            <ProgressBar value={fraction} color={d.status === 'Overdue' ? p.danger : p.success} />
            <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 4 }}>
              {t('mob.paidPercent', { p: Math.round(fraction * 100) })}
            </Text>
          </>
        )}
      </Card>

      {d.guarantors.length > 0 && (
        <>
          <SectionHeader>{t('mob.guarantors')}</SectionHeader>
          <Card>
            {d.guarantors.map((name, i) => (
              <Text key={i} style={{ color: p.text, fontSize: 15, paddingVertical: 6 }}>
                {name}
              </Text>
            ))}
          </Card>
        </>
      )}

      <SectionHeader>{t('mob.repayments')}</SectionHeader>
      <Card style={{ paddingVertical: 4 }}>
        {d.payments.length === 0 && <EmptyText>{t('mob.noRepayments')}</EmptyText>}
        {d.payments.map((payment, i) => {
          const paid = payment.principal_paid + payment.interest_paid + payment.fines_paid
          return (
            <View
              key={payment.id}
              style={{ paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{formatDate(payment.date)}</Text>
                <Money cents={paid} bold color={p.success} />
              </View>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>
                {t('mob.principal')}: {(payment.principal_paid / 100).toLocaleString()} · {t('mob.interest')}:{' '}
                {(payment.interest_paid / 100).toLocaleString()} · {t('mob.fines')}: {(payment.fines_paid / 100).toLocaleString()}
              </Text>
            </View>
          )
        })}
      </Card>

      {society.isSuccess && (
        <>
          <SectionHeader>{t('mob.loanTerms')}</SectionHeader>
          <Card>
            <Row label={t('mob.monthlyInterest')} value={`${society.data.monthly_interest_rate ?? '—'}%`} />
            <Row label={t('mob.lateFine')} value={`${society.data.late_fine_rate ?? '—'}%`} />
          </Card>
        </>
      )}
    </Screen>
  )
}
