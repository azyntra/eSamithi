import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useDues } from '../api/hooks'
import { Card, EmptyState, ErrorView, Money, Row, Screen, SectionHeader, SkeletonCards, StaleBanner } from '../ui'

// "What exactly do I owe?" — expansion of the Home dues banner
export default function Dues(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const dues = useDues()

  if (dues.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (dues.isError && !dues.data) {
    return (
      <Screen refreshing={dues.isRefetching} onRefresh={() => dues.refetch()}>
        <ErrorView onRetry={() => dues.refetch()} />
      </Screen>
    )
  }

  const d = dues.data!
  const totalDue = d.overdue_loans.reduce((s, l) => s + l.principal_owed + l.interest_owed + l.fines_owed, 0)
  const allClear = d.overdue_loans.length === 0 && d.membership_fee_paid !== false

  return (
    <Screen refreshing={dues.isRefetching} onRefresh={() => dues.refetch()}>
      {dues.isError && <StaleBanner />}

      {allClear ? (
        <EmptyState icon="checkmark-done-circle-outline" text={t('mob.allGood')} />
      ) : (
        <>
          <Card>
            <Text style={{ color: p.textMuted, fontSize: 13, marginBottom: 6 }}>{t('mob.totalOwed')}</Text>
            <Money cents={totalDue} size={24} bold color={totalDue > 0 ? p.danger : p.success} />
          </Card>

          {d.overdue_loans.length > 0 && <SectionHeader>{t('mob.tabLoans')}</SectionHeader>}
          {d.overdue_loans.map((loan) => (
            <Card key={loan.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{t('mob.loanNum', { id: loan.id })}</Text>
                <Pressable
                  onPress={() => router.push(`/loan/${loan.id}`)}
                  accessibilityRole="button"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Text style={{ color: p.primary, fontSize: 14, fontWeight: '700' }}>{t('mob.viewLoan')}</Text>
                  <Ionicons name="chevron-forward" size={15} color={p.primary} />
                </Pressable>
              </View>
              <Row label={t('mob.principal')} value={<Money cents={loan.principal_owed} />} />
              <Row label={t('mob.interest')} value={<Money cents={loan.interest_owed} color={p.warning} />} />
              <Row label={t('mob.fines')} value={<Money cents={loan.fines_owed} color={p.danger} />} />
            </Card>
          ))}

          {d.membership_fee_paid === false && (
            <>
              <SectionHeader>{t('mob.membershipFee')}</SectionHeader>
              <Card>
                <Row label={t('mob.membershipFee')} value={t('mob.feeDue')} />
                <Text style={{ color: p.textMuted, fontSize: 13, marginTop: 6, lineHeight: 19 }}>
                  {t('mob.membershipFeeDue')}
                </Text>
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  )
}
