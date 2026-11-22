import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../i18n'
import { spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useProfile } from '../api/hooks'
import { formatDate } from '../lib/date'
import { Button, Callout, DetailRow, ErrorView, GroupLabel, MemberHeader, ScalePressable, Screen, SkeletonCards, StaleBanner, useCardStyle } from '../ui'

// Profile (redesign §6.6.1): who the society has on record, grouped, every
// value wrapping rather than truncating; the account number is masked until
// asked for, because phones are shared.
export default function Profile(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const card = useCardStyle()
  const profile = useProfile()
  const [showAccount, setShowAccount] = useState(false)

  if (profile.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (profile.isError && !profile.data) {
    return (
      <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
        <ErrorView onRetry={() => profile.refetch()} />
      </Screen>
    )
  }

  const d = profile.data!
  const account = d.bank_account_number ?? ''
  const masked = account.length > 4 ? `•••• ${account.slice(-4)}` : account
  const group = (children: React.ReactNode): React.ReactElement => <View style={[card, { paddingHorizontal: spacing.lg }]}>{children}</View>

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      {profile.isError && <StaleBanner />}
      <MemberHeader name={d.full_name} sub={`${t('mob.memberNo')} ${d.society_id}`} />

      <GroupLabel>{t('mob.personal')}</GroupLabel>
      {group(
        <>
          <DetailRow first icon="card-outline" label={t('mob.nic')} value={d.nic} />
          <DetailRow icon="calendar-outline" label={t('mob.dob')} value={formatDate(d.date_of_birth)} />
          <DetailRow icon="person-outline" label={t('mob.gender')} value={d.gender} />
          <DetailRow icon="heart-outline" label={t('mob.maritalStatus')} value={d.marital_status} />
          <DetailRow icon="briefcase-outline" label={t('mob.occupation')} value={d.occupation} />
        </>
      )}

      <GroupLabel>{t('mob.contactSection')}</GroupLabel>
      {group(
        <>
          <DetailRow first icon="call-outline" label={t('common.phone')} value={d.phone} />
          <DetailRow icon="home-outline" label={t('mob.address')} value={d.address} />
        </>
      )}

      <GroupLabel>{t('mob.bankDetails')}</GroupLabel>
      {group(
        <>
          <DetailRow first icon="business-outline" label={t('mob.bankName')} value={d.bank_name} />
          <DetailRow icon="person-circle-outline" label={t('mob.accountHolder')} value={d.bank_account_holder_name} />
          <DetailRow
            icon="wallet-outline"
            label={t('mob.accountNumber')}
            value={showAccount ? account : masked}
            right={account.length > 4 && !showAccount ? (
              <ScalePressable accessibilityRole="button" onPress={() => setShowAccount(true)} style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm }}>
                <Text style={{ color: p.primary, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.tapToReveal')}</Text>
              </ScalePressable>
            ) : undefined}
          />
        </>
      )}

      <GroupLabel>{t('mob.membershipSection')}</GroupLabel>
      {group(<DetailRow first icon="ribbon-outline" label={t('mob.joined')} value={formatDate(d.date_of_joining)} />)}

      {d.dependents.length > 0 ? (
        <>
          <GroupLabel>{t('mob.dependents')}</GroupLabel>
          {group(
            <>
              {d.dependents.map((dep, i) => (
                <DetailRow key={i} first={i === 0} icon="people-outline" label={dep.relationship ?? ''} value={dep.name} />
              ))}
            </>
          )}
        </>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <Callout text={t('mob.contactOffice')}>
        <Button label={t('mob.askCorrection')} variant="secondary" icon="create-outline" onPress={() => router.push('/new-request')} />
      </Callout>
    </Screen>
  )
}
