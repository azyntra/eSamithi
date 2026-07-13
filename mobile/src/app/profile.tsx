import React from 'react'
import { Text } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useProfile } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Banner, Card, EmptyText, ErrorView, Row, Screen, SkeletonCards, StaleBanner, SectionHeader } from '../ui'

export default function Profile(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const profile = useProfile()

  if (profile.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (profile.isError && !profile.data) {
    return (
      <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
        <ErrorView onRetry={() => profile.refetch()} />
      </Screen>
    )
  }

  const d = profile.data!

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      {profile.isError && <StaleBanner />}
      <SectionHeader>{t('mob.personal')}</SectionHeader>
      <Card>
        <Row label={t('common.name')} value={d.full_name} />
        <Row label={t('common.societyId')} value={d.society_id} />
        <Row label={t('mob.nic')} value={d.nic} />
        <Row label={t('mob.dob')} value={formatDate(d.date_of_birth)} />
        <Row label={t('mob.gender')} value={d.gender} />
        <Row label={t('mob.maritalStatus')} value={d.marital_status} />
        <Row label={t('mob.occupation')} value={d.occupation} />
        <Row label={t('common.phone')} value={d.phone} />
        <Row label={t('mob.address')} value={d.address} />
        <Row label={t('mob.joined')} value={formatDate(d.date_of_joining)} />
      </Card>

      <SectionHeader>{t('mob.bankDetails')}</SectionHeader>
      <Card>
        <Row label={t('mob.bankName')} value={d.bank_name} />
        <Row label={t('mob.accountHolder')} value={d.bank_account_holder_name} />
        <Row label={t('mob.accountNumber')} value={d.bank_account_number} />
      </Card>

      <SectionHeader>{t('mob.dependents')}</SectionHeader>
      <Card>
        {d.dependents.length === 0 && <EmptyText>—</EmptyText>}
        {d.dependents.map((dep, i) => (
          <Text key={i} style={{ color: p.text, fontSize: 15, paddingVertical: 6 }}>
            {dep.name}
            {dep.relationship ? <Text style={{ color: p.textMuted }}> · {dep.relationship}</Text> : null}
          </Text>
        ))}
      </Card>

      <Banner kind="warning" text={t('mob.contactOffice')} />
    </Screen>
  )
}
