import React, { useEffect } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { dist, dur, ease } from '../../motion'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { spacing, radius, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { Button, LangToggle, LogoTile, ScalePressable } from '../../ui'


// The welcome screen is the only place in the app that stagger earns its keep:
// five elements, seen once, on the screen whose job is to introduce the brand.
// 260 ms each, 30 ms apart, critically damped, travelling 12 px. Total 380 ms
// against the ~2.1 s of overshooting cascade this replaces.
const arrive = (i: number) =>
  FadeInDown.duration(dur.enter)
    .delay(i * dur.stagger)
    .easing(ease.enter)
    .withInitialValues({ transform: [{ translateY: dist.rise }] })

// The button pair sits at the bottom edge, so it rises from below its mark.
const arriveUp = (i: number) =>
  FadeInUp.duration(dur.enter)
    .delay(i * dur.stagger)
    .easing(ease.enter)
    .withInitialValues({ transform: [{ translateY: -dist.rise }] })

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
        <Animated.View entering={arrive(0)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.xxl }}>
          <LogoTile size={64} />
          <Text style={{ fontSize: 28, fontFamily: interFamily.extrabold, color: p.text }}>
            e<Text style={{ color: p.primary, fontFamily: interFamily.extrabold }}>Samithi</Text>
          </Text>
        </Animated.View>

        <Animated.Text
          entering={arrive(1)}
          style={{ fontSize: 28, fontFamily: ty.family.extrabold, lineHeight: ty.lh(28), color: p.text, marginBottom: spacing.md - 2 }}
        >
          {t('mob.welcomeTitle')}
        </Animated.Text>
        <Animated.Text
          entering={arrive(2)}
          style={{ fontSize: 16, fontFamily: ty.family.regular, lineHeight: ty.lh(16), color: p.textMuted }}
        >
          {t('mob.welcomeSubtitle')}
        </Animated.Text>

        <Animated.View entering={arrive(3)} style={{ alignSelf: 'flex-start' }}>
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
            <Text style={{ color: p.text, fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14) }}>
              {pendingProfile.name || pendingProfile.code || pendingProfile.slug}
            </Text>
            <Text style={{ color: p.primary, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }}>· {t('mob.samithiChange')}</Text>
          </ScalePressable>
        </Animated.View>
      </View>

      <Animated.View entering={arriveUp(4)}>
        <Button label={t('mob.getStarted')} onPress={() => router.push('/(auth)/verify')} />
        <View style={{ height: spacing.sm + 2 }} />
        <Button label={t('mob.alreadyEnrolled')} variant="secondary" onPress={() => router.push('/(auth)/login')} />
      </Animated.View>
    </View>
  )
}
