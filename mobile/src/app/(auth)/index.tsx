import React from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { dist, dur, ease } from '../../motion'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { spacing, radius, type as typeScale, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { HeroGradient, LogoChip, ScalePressable } from '../../ui'


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

// White solid and white outlined buttons: the brand gradient button would
// disappear on the gradient background.
function HeroButton({ label, onPress, outline }: { label: string; onPress: () => void; outline?: boolean }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <ScalePressable
      accessibilityRole="button"
      haptic="impact"
      onPress={onPress}
      style={{
        minHeight: 56,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        backgroundColor: outline ? 'transparent' : p.onHero,
        borderWidth: outline ? 1.5 : 0,
        borderColor: p.onHeroMuted
      }}
    >
      <Text style={{ color: outline ? p.onHero : p.heroEnd, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
    </ScalePressable>
  )
}

// Language switch drawn for the gradient (the app's Segmented is for surfaces)
function HeroLangToggle(): React.ReactElement {
  const { lang, setLang } = useT()
  const p = usePalette()
  const ty = useType()
  const opt = (code: 'si' | 'en', label: string): React.ReactElement => {
    const on = lang === code
    return (
      <ScalePressable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        haptic="selection"
        onPress={() => setLang(code)}
        style={{ minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: on ? p.onHero : 'transparent', paddingHorizontal: spacing.md }}
      >
        <Text style={{ color: on ? p.heroEnd : p.onHero, fontSize: typeScale.caption, fontFamily: code === 'en' ? interFamily.bold : ty.family.bold, lineHeight: ty.lh(typeScale.caption) }}>{label}</Text>
      </ScalePressable>
    )
  }
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: p.heroGlass, borderRadius: radius.pill, padding: 3 }}>
      {opt('si', 'සිං')}
      {opt('en', 'EN')}
    </View>
  )
}

// Welcome (redesign §6.1.1): the brand gradient, the eS tile, one sentence of
// what the app is for, and the way in.
export default function Welcome(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { pendingProfile } = useAuth()

  // Everything downstream (verify/login) needs to know which samithi it talks
  // to, so the code has to come first — but the welcome is still the first
  // screen, and its one action goes and gets the code.

  return (
    <View style={{ flex: 1, padding: spacing.xxl, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}>
      <HeroGradient />
      <View style={{ alignItems: 'flex-end' }}>
        <HeroLangToggle />
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Animated.View entering={arrive(0)}>
          <LogoChip size={96} />
        </Animated.View>

        <Animated.Text
          entering={arrive(1)}
          style={{ fontSize: typeScale.display, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.display), color: p.onHero, textAlign: 'center', marginTop: spacing.xxl }}
        >
          {t('mob.welcomeTitle')}
        </Animated.Text>
        <Animated.Text
          entering={arrive(2)}
          style={{ fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), color: p.onHeroMuted, textAlign: 'center', marginTop: spacing.md, maxWidth: 320 }}
        >
          {t('mob.welcomeSubtitle')}
        </Animated.Text>

        {pendingProfile ? (
          <Animated.View entering={arrive(3)}>
            <ScalePressable
              accessibilityRole="button"
              haptic="selection"
              onPress={() => router.push('/(auth)/samithi')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, minHeight: 44, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill, backgroundColor: p.heroGlass }}
            >
              <Ionicons name="business-outline" size={16} color={p.onHero} />
              <Text style={{ color: p.onHero, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>
                {pendingProfile.name || pendingProfile.code || pendingProfile.slug}
              </Text>
              <Text style={{ color: p.onHeroMuted, fontSize: typeScale.caption, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.caption), textDecorationLine: 'underline' }}>{t('mob.samithiChange')}</Text>
            </ScalePressable>
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={arriveUp(4)} style={{ gap: spacing.md }}>
        {pendingProfile ? (
          <>
            <HeroButton label={t('mob.getStarted')} onPress={() => router.push('/(auth)/verify')} />
            <HeroButton label={t('mob.alreadyEnrolled')} outline onPress={() => router.push('/(auth)/login')} />
          </>
        ) : (
          <HeroButton label={t('mob.getStarted')} onPress={() => router.push('/(auth)/samithi')} />
        )}
      </Animated.View>
    </View>
  )
}
