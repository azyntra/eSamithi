import React, { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { spacing, radius, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { Button, LangToggle, LogoTile, ScalePressable } from '../../ui'

export default function Welcome(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
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
    <View style={{ flex: 1, backgroundColor: p.bg, padding: spacing.xxl, paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }}>
      <View style={{ alignItems: 'flex-end' }}>
        <LangToggle />
      </View>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View entering={FadeInDown.duration(500).springify().damping(18)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xxl }}>
          <LogoTile size={64} />
          <Text style={{ fontSize: 34, fontFamily: interFamily.extrabold, color: p.text }}>
            e<Text style={{ color: p.primary }}>Samithi</Text>
          </Text>
        </Animated.View>

        <Animated.Text
          entering={FadeInDown.delay(80).duration(500).springify().damping(18)}
          style={{ fontSize: 26, fontFamily: ty.family.extrabold, lineHeight: ty.lh(26), color: p.text, marginBottom: spacing.md - 2 }}
        >
          {t('mob.welcomeTitle')}
        </Animated.Text>
        <Animated.Text
          entering={FadeInDown.delay(160).duration(500).springify().damping(18)}
          style={{ fontSize: 16, fontFamily: ty.family.regular, lineHeight: ty.lh(16), color: p.textMuted }}
        >
          {t('mob.welcomeSubtitle')}
        </Animated.Text>

        <Animated.View entering={FadeInDown.delay(240).duration(500).springify().damping(18)} style={{ alignSelf: 'flex-start' }}>
          <ScalePressable
            accessibilityRole="button"
            haptic="selection"
            onPress={() => router.push('/(auth)/samithi')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.xl - 2,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md + 2,
              borderRadius: radius.pill,
              backgroundColor: p.primarySoft
            }}
          >
            <Ionicons name="people-circle-outline" size={16} color={p.primary} />
            <Text style={{ color: p.text, fontSize: 13, fontFamily: ty.family.semibold, lineHeight: ty.lh(13) }}>
              {pendingProfile.name || pendingProfile.code || pendingProfile.slug}
            </Text>
            <Text style={{ color: p.primary, fontSize: 13, fontFamily: ty.family.bold, lineHeight: ty.lh(13) }}>· {t('mob.samithiChange')}</Text>
          </ScalePressable>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(320).duration(500).springify().damping(18)}>
        <Button label={t('mob.getStarted')} onPress={() => router.push('/(auth)/verify')} />
        <View style={{ height: spacing.sm + 2 }} />
        <Button label={t('mob.alreadyEnrolled')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </Animated.View>
    </View>
  )
}
