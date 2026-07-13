import React from 'react'
import { Text } from 'react-native'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useProfile, useSocietyInfo } from '../api/hooks'
import { ErrorView, Screen, SkeletonCards, StaleBanner } from '../ui'
import { MembershipCard } from '../ui/MembershipCard'

// Digital membership card — something members can show at the office or a
// funeral house instead of a paper book. QR carries the society ID.
export default function MemberCardScreen(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const profile = useProfile()
  const society = useSocietyInfo()

  if (profile.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (profile.isError && !profile.data) {
    return (
      <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
        <ErrorView onRetry={() => profile.refetch()} />
      </Screen>
    )
  }

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      {profile.isError && <StaleBanner />}
      <MembershipCard profile={profile.data!} societyName={society.data?.society_name ?? 'Maranadhara Samithi'} />
      <Text style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', marginTop: 16 }}>
        {t('mob.cardShowOffice')}
      </Text>
    </Screen>
  )
}
