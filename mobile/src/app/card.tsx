import React, { useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useProfile, useSocietyInfo } from '../api/hooks'
import { Button, ErrorView, Screen, SkeletonCards, StaleBanner, useToast } from '../ui'
import { MembershipCard } from '../ui/MembershipCard'

// Digital membership card — something members can show at the office or a
// funeral house instead of a paper book. QR carries the society ID.
// Share renders the card view to a PNG and hands it to the system share
// sheet, so it lands in WhatsApp/SMS as an image with the QR intact.
export default function MemberCardScreen(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const toast = useToast()
  const profile = useProfile()
  const society = useSocietyInfo()
  const shotRef = useRef<View>(null)
  const [sharing, setSharing] = useState(false)

  const shareCard = async (): Promise<void> => {
    if (sharing) return
    setSharing(true)
    try {
      const uri = await captureRef(shotRef, { format: 'png', quality: 1 })
      if (!(await Sharing.isAvailableAsync())) throw new Error('sharing unavailable')
      await Sharing.shareAsync(uri.startsWith('file://') ? uri : `file://${uri}`, {
        mimeType: 'image/png', // Android share intent
        UTI: 'public.png', // iOS counterpart
        dialogTitle: t('mob.cardShare')
      })
    } catch {
      // shareAsync resolves quietly when the user dismisses the sheet, so a
      // throw here is a real failure worth surfacing
      toast.show('error', t('mob.cardShareFail'))
    } finally {
      setSharing(false)
    }
  }

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
      {/* Padded backdrop so the captured PNG has clean margins instead of
          transparent rounded corners (some messengers render those black).
          collapsable={false} keeps Android from optimizing the view away. */}
      <View
        ref={shotRef}
        collapsable={false}
        style={{ backgroundColor: p.bg, padding: 14, margin: -14, borderRadius: 0 }}
      >
        <MembershipCard profile={profile.data!} societyName={society.data?.society_name ?? 'Maranadhara Samithi'} />
      </View>
      <View style={{ marginTop: 16 }}>
        <Button label={t('mob.cardShare')} icon="share-social-outline" onPress={shareCard} loading={sharing} />
      </View>
      <Text style={{ color: p.textMuted, fontSize: 13, textAlign: 'center', marginTop: 14 }}>
        {t('mob.cardShowOffice')}
      </Text>
    </Screen>
  )
}
