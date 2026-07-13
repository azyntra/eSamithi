import React, { useEffect } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Button, LangToggle } from '../../ui'

export default function Welcome(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { pendingProfile } = useAuth()

  // Multi-samithi: everything downstream (verify/login) needs to know which
  // samithi it talks to — the code screen provides that first
  useEffect(() => {
    if (!pendingProfile) router.replace('/(auth)/samithi')
  }, [pendingProfile, router])

  if (!pendingProfile) return <View style={{ flex: 1, backgroundColor: p.bg }} />

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, padding: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
      <View style={{ alignItems: 'flex-end' }}>
        <LangToggle />
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: p.primary, marginBottom: 8 }}>eSamithi</Text>
        <Text style={{ fontSize: 26, fontWeight: '700', color: p.text, marginBottom: 10 }}>{t('mob.welcomeTitle')}</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: p.textMuted }}>{t('mob.welcomeSubtitle')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/samithi')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            gap: 6,
            marginTop: 18,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 100,
            backgroundColor: p.surfaceAlt
          }}
        >
          <Ionicons name="people-circle-outline" size={16} color={p.primary} />
          <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
            {pendingProfile.name || pendingProfile.code || pendingProfile.slug}
          </Text>
          <Text style={{ color: p.primary, fontSize: 13, fontWeight: '700' }}>· {t('mob.samithiChange')}</Text>
        </Pressable>
      </View>
      <Button label={t('mob.getStarted')} onPress={() => router.push('/(auth)/verify')} />
      <View style={{ height: 10 }} />
      <Button label={t('mob.alreadyEnrolled')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
    </View>
  )
}
