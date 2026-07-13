import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useStatement, type StatementLoan } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { Card, EmptyState, ErrorView, Money, ProgressBar, Row, Screen, SkeletonCards, StaleBanner, StatusBadge } from '../../ui'

// Repaid fraction of the original principal (0..1); migrated loans may have
// odd principal_amounts, so clamp and guard the division.
export function repaidFraction(loan: StatementLoan): number | null {
  if (loan.principal_amount <= 0) return null
  return Math.max(0, Math.min(1, (loan.principal_amount - loan.principal_owed) / loan.principal_amount))
}

export default function Loans(): React.ReactElement {
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

  const loans = statement.data!.loans

  return (
    <Screen refreshing={statement.isRefetching} onRefresh={() => statement.refetch()}>
      {statement.isError && <StaleBanner />}
      {loans.length === 0 && <EmptyState icon="business-outline" text={t('mob.noLoans')} />}
      {loans.map((loan) => {
        const owed = loan.principal_owed + loan.interest_owed + loan.fines_owed
        const open = loan.status === 'Active' || loan.status === 'Overdue'
        const fraction = repaidFraction(loan)
        return (
          <Pressable key={loan.id} onPress={() => router.push(`/loan/${loan.id}`)} accessibilityRole="button">
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <StatusBadge status={loan.status} />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ color: p.textMuted, fontSize: 13 }}>{t('mob.loanIssued', { date: formatDate(loan.date_issued) })}</Text>
                  <Ionicons name="chevron-forward" size={16} color={p.textMuted} />
                </View>
              </View>
              <Row label={t('mob.originalAmount')} value={<Money cents={loan.principal_amount} />} />
              <Row label={t('mob.totalOwed')} value={<Money cents={owed} bold color={owed > 0 ? p.warning : p.success} />} bold />
              {open && fraction !== null && (
                <>
                  <ProgressBar value={fraction} color={loan.status === 'Overdue' ? p.danger : p.success} />
                  <Text style={{ color: p.textMuted, fontSize: 12, marginTop: 4 }}>
                    {t('mob.paidPercent', { p: Math.round(fraction * 100) })}
                  </Text>
                </>
              )}
            </Card>
          </Pressable>
        )
      })}
    </Screen>
  )
}
