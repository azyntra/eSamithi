import React from 'react'
import { Text } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useSocietyInfo } from '../api/hooks'
import { formatCurrency } from '../lib/money'
import { Card, ErrorView, Row, Screen, SkeletonCards, StaleBanner, SectionHeader } from '../ui'

export default function Society(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
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

  return (
    <Screen refreshing={society.isRefetching} onRefresh={() => society.refetch()}>
      {society.isError && <StaleBanner />}
      <Text style={{ color: p.text, fontSize: 22, fontWeight: '800', marginBottom: 16 }}>
        {d.society_name ?? 'Maranadhara Samithi'}
      </Text>

      {(d.society_phone || d.society_address) && (
        <>
          <SectionHeader>{t('mob.officeContact')}</SectionHeader>
          <Card>
            {d.society_phone ? <Row label={t('common.phone')} value={d.society_phone} /> : null}
            {d.society_address ? <Row label={t('mob.address')} value={d.society_address} /> : null}
          </Card>
        </>
      )}

      <SectionHeader>{t('mob.loanTerms')}</SectionHeader>
      <Card>
        <Row label={t('mob.monthlyInterest')} value={`${d.monthly_interest_rate ?? '—'}%`} />
        <Row label={t('mob.lateFine')} value={`${d.late_fine_rate ?? '—'}%`} />
        <Row label={t('mob.maxLoan')} value={maxLoanCents ? formatCurrency(maxLoanCents) : '—'} />
        <Row label={t('mob.reqGuarantors')} value={d.required_guarantors ?? '—'} />
      </Card>
    </Screen>
  )
}
