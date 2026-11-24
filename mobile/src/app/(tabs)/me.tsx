import React, { useEffect, useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { BIOMETRIC_KEY, useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { useProfile, useSocietyInfo } from '../../api/hooks'
import { radius, spacing, type as typeScale, usePalette, useThemeMode, type ThemeMode } from '../../theme'
import { interFamily, useType } from '../../typography'
import {
  Avatar,
  Card,
  GroupLabel,
  HeroGradient,
  LangToggle,
  ListRow,
  LogoChip,
  LogoTile,
  ScalePressable,
  Screen,
  Segmented
} from '../../ui'

// Me (redesign §6.6): replaces the old "More" junk drawer with four groups a
// member can predict — my membership, my society, staff tools, the app.

interface NavItem {
  href: Href
  icon: keyof typeof Ionicons.glyphMap
  label: string
}

export default function Me(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const { signOut, profiles, activeProfile, switchProfile, addSamithi } = useAuth()
  const { mode, setMode } = useThemeMode()
  const profile = useProfile()
  const society = useSocietyInfo()
  const insets = useSafeAreaInsets()

  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const available = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
        setBioAvailable(available)
        setBioEnabled((await SecureStore.getItemAsync(BIOMETRIC_KEY)) === '1')
      } catch {
        setBioAvailable(false)
      }
    })()
  }, [])

  const toggleBiometric = async (next: boolean): Promise<void> => {
    if (next) {
      // Prove it works before trusting it as the app gate
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'eSamithi' })
      if (!result.success) return
    }
    setBioEnabled(next)
    SecureStore.setItemAsync(BIOMETRIC_KEY, next ? '1' : '0').catch(() => {})
  }

  const prof = profile.data
  const isStaff = prof?.permissions?.includes('attendance') === true
  const isSecretary = prof?.permissions?.includes('minutes') === true
  const societyName = society.data?.society_name ?? activeProfile?.name ?? ''

  const membership: NavItem[] = [
    { href: '/card', icon: 'id-card-outline', label: t('mob.memberCard') },
    { href: '/profile', icon: 'person-outline', label: t('mob.myProfile') },
    { href: '/requests', icon: 'document-text-outline', label: t('mob.requests') },
    { href: '/puruka-mine', icon: 'pricetags-outline', label: t('mob.pkMyPosts') },
    { href: '/benefits', icon: 'gift-outline', label: t('mob.benefits') },
    { href: '/guarantees', icon: 'people-outline', label: t('mob.guarantees') }
  ]
  const societyItems: NavItem[] = [
    { href: '/meeting-records', icon: 'book-outline', label: t('mob.mmTitle') },
    { href: '/society', icon: 'business-outline', label: t('mob.societyInfo') },
    { href: '/society-funds', icon: 'stats-chart-outline', label: t('mob.fundsTitle') },
    { href: '/help', icon: 'help-buoy-outline', label: t('mob.help') }
  ]

  const group = (items: NavItem[]): React.ReactElement => (
    <Card style={{ paddingVertical: 0 }}>
      {items.map((item, i) => (
        <ListRow key={item.label} first={i === 0} icon={item.icon} label={item.label} onPress={() => router.push(item.href)} />
      ))}
    </Card>
  )

  const confirmLogout = (): void => {
    Alert.alert(t('sidebar.signOutConfirmTitle'), t('sidebar.signOutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sidebar.signOut'), style: 'destructive', onPress: () => { signOut() } }
    ])
  }

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      {/* Who I am */}
      <ScalePressable
        accessibilityRole="button"
        onPress={() => router.push('/profile')}
        scaleTo={0.98}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2, marginTop: insets.top }}
      >
        <Avatar name={prof?.full_name ?? '?'} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title) }}>{prof?.full_name ?? ''}</Text>
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>
            {prof ? `${t('mob.memberNo')} ${prof.society_id}` : ''}{societyName ? ` · ${societyName}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
      </ScalePressable>

      {/* Mini membership card → full card */}
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={t('mob.memberCard')}
        onPress={() => router.push('/card')}
        scaleTo={0.98}
        style={{ marginTop: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <HeroGradient rounded={radius.lg} />
        <LogoChip size={40} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.onHeroMuted, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.memberCard')}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ color: p.onHero, fontSize: typeScale.title, fontFamily: interFamily.extrabold }}>{prof?.society_id ?? ''}</Text>
        </View>
        <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: p.onHero, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="qr-code-outline" size={28} color={p.heroEnd} />
        </View>
      </ScalePressable>

      <GroupLabel>{t('mob.meMembership')}</GroupLabel>
      {group(membership)}

      <GroupLabel>{t('mob.meSociety')}</GroupLabel>
      {group(societyItems)}

      <GroupLabel>{t('mob.meSafety')}</GroupLabel>
      {group([{ href: '/report', icon: 'shield-checkmark-outline', label: t('mob.reportConcern') }])}

      {isSecretary ? (
        <>
          <GroupLabel>{t('mob.mmOfficerGroup')}</GroupLabel>
          {group([{ href: '/meeting-records/secretary', icon: 'create-outline', label: t('mob.mmSecretaryRow') }])}
        </>
      ) : null}

      {isStaff ? (
        <>
          <GroupLabel>{t('mob.meStaff')}</GroupLabel>
          {group([{ href: '/attendance', icon: 'scan-outline', label: t('mob.attMenu') }])}
        </>
      ) : null}

      <GroupLabel>{t('mob.meApp')}</GroupLabel>
      <Card>
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), marginBottom: spacing.sm }}>{t('mob.language')}</Text>
        <LangToggle />
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), marginTop: spacing.lg, marginBottom: spacing.sm }}>{t('mob.theme')}</Text>
        <Segmented<ThemeMode>
          options={[
            { value: 'system', label: t('mob.themeSystem') },
            { value: 'light', label: t('mob.themeLight') },
            { value: 'dark', label: t('mob.themeDark') }
          ]}
          value={mode}
          onChange={setMode}
        />
        {bioAvailable ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: p.border }}>
            <Ionicons name="finger-print-outline" size={24} color={p.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{t('mob.biometric')}</Text>
              <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.biometricHint')}</Text>
            </View>
            <Switch value={bioEnabled} onValueChange={toggleBiometric} trackColor={{ true: p.primary }} accessibilityLabel={t('mob.biometric')} />
          </View>
        ) : null}
      </Card>

      {/* Multi-samithi switcher — silent when the other samithi's session is
          alive, otherwise its login screen */}
      <GroupLabel>{t('mob.samithiSection')}</GroupLabel>
      <Card style={{ paddingVertical: 0 }}>
        {profiles.map((pr, i) => {
          const isActive = pr.slug === activeProfile?.slug
          return (
            <ScalePressable
              key={pr.slug}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              haptic="selection"
              disabled={switching || isActive}
              onPress={async () => {
                setSwitching(true)
                try { await switchProfile(pr.slug) } finally { setSwitching(false) }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: p.border, opacity: switching ? 0.5 : 1 }}
            >
              <Ionicons name={isActive ? 'radio-button-on' : 'radio-button-off'} size={22} color={isActive ? p.primary : p.textMuted} style={{ marginRight: spacing.md }} />
              <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body), flex: 1 }}>
                {pr.name || pr.code || pr.slug}
              </Text>
              {isActive ? <Text style={{ color: p.primary, fontSize: typeScale.micro, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.samithiActive')}</Text> : null}
            </ScalePressable>
          )
        })}
        <ScalePressable
          accessibilityRole="button"
          onPress={addSamithi}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, borderTopWidth: profiles.length === 0 ? 0 : 1, borderTopColor: p.border }}
        >
          <Ionicons name="add-circle-outline" size={22} color={p.primary} style={{ marginRight: spacing.md }} />
          <Text style={{ color: p.primary, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{t('mob.samithiAdd')}</Text>
        </ScalePressable>
      </Card>

      <ScalePressable
        onPress={confirmLogout}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 56, marginTop: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: p.danger }}
      >
        <Ionicons name="log-out-outline" size={20} color={p.danger} style={{ marginRight: spacing.sm }} />
        <Text style={{ color: p.danger, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{t('sidebar.signOut')}</Text>
      </ScalePressable>

      <View style={{ alignItems: 'center', marginTop: spacing.xl, gap: spacing.sm }}>
        <LogoTile size={34} />
        <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>
          {t('mob.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </View>
    </Screen>
  )
}
