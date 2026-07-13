import React, { useEffect, useState } from 'react'
import { Alert, Pressable, Switch, Text, View } from 'react-native'
import { useRouter, type Href } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { BIOMETRIC_KEY, useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { usePalette, useThemeMode, type ThemeMode } from '../../theme'
import { Card, LangToggle, Screen, SectionHeader, Segmented } from '../../ui'

export default function More(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const { signOut, profiles, activeProfile, switchProfile, addSamithi } = useAuth()
  const { mode, setMode } = useThemeMode()

  const [bioAvailable, setBioAvailable] = useState(false)
  const [bioEnabled, setBioEnabled] = useState(false)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const available =
          (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
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

  const items: Array<{ href: Href; icon: keyof typeof Ionicons.glyphMap; label: string }> = [
    { href: '/card', icon: 'id-card-outline', label: t('mob.memberCard') },
    { href: '/puruka-mine', icon: 'pricetags-outline', label: t('mob.pkMyPosts') },
    { href: '/requests', icon: 'document-text-outline', label: t('mob.requests') },
    { href: '/profile', icon: 'person-outline', label: t('mob.myProfile') },
    { href: '/benefits', icon: 'gift-outline', label: t('mob.benefits') },
    { href: '/payouts', icon: 'wallet-outline', label: t('mob.payouts') },
    { href: '/guarantees', icon: 'people-outline', label: t('mob.guarantees') },
    { href: '/society-funds', icon: 'stats-chart-outline', label: t('mob.fundsTitle') },
    { href: '/society', icon: 'information-circle-outline', label: t('mob.societyInfo') },
    { href: '/help', icon: 'help-circle-outline', label: t('mob.help') }
  ]

  const confirmLogout = (): void => {
    Alert.alert(t('sidebar.signOutConfirmTitle'), t('sidebar.signOutConfirmMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sidebar.signOut'), style: 'destructive', onPress: () => { signOut() } }
    ])
  }

  return (
    <Screen>
      <Card style={{ paddingVertical: 4 }}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 15,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: p.border
            }}
          >
            <Ionicons name={item.icon} size={22} color={p.primary} style={{ marginRight: 14 }} />
            <Text style={{ color: p.text, fontSize: 16, fontWeight: '600', flex: 1 }}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
          </Pressable>
        ))}
      </Card>

      {/* Multi-samithi switcher (plan §2.6) — silent when the other
          samithi's session is alive, otherwise its login screen */}
      <SectionHeader>{t('mob.samithiSection')}</SectionHeader>
      <Card style={{ paddingVertical: 4 }}>
        {profiles.map((profile, i) => {
          const isActive = profile.slug === activeProfile?.slug
          return (
            <Pressable
              key={profile.slug}
              accessibilityRole="button"
              disabled={switching || isActive}
              onPress={async () => {
                setSwitching(true)
                try { await switchProfile(profile.slug) } finally { setSwitching(false) }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 14,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: p.border,
                opacity: switching ? 0.5 : 1
              }}
            >
              <Ionicons
                name={isActive ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={isActive ? p.primary : p.textMuted}
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', flex: 1 }}>
                {profile.name || profile.code || profile.slug}
              </Text>
              {isActive && (
                <Text style={{ color: p.primary, fontSize: 12, fontWeight: '700' }}>{t('mob.samithiActive')}</Text>
              )}
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="button"
          onPress={addSamithi}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            borderTopWidth: profiles.length === 0 ? 0 : 1,
            borderTopColor: p.border
          }}
        >
          <Ionicons name="add-circle-outline" size={20} color={p.primary} style={{ marginRight: 12 }} />
          <Text style={{ color: p.primary, fontSize: 15, fontWeight: '600' }}>{t('mob.samithiAdd')}</Text>
        </Pressable>
      </Card>

      <SectionHeader>{t('mob.theme')}</SectionHeader>
      <Segmented<ThemeMode>
        options={[
          { value: 'system', label: t('mob.themeSystem') },
          { value: 'light', label: t('mob.themeLight') },
          { value: 'dark', label: t('mob.themeDark') }
        ]}
        value={mode}
        onChange={setMode}
      />

      <SectionHeader>{t('mob.language')}</SectionHeader>
      <LangToggle />

      {bioAvailable && (
        <>
          <SectionHeader>{t('mob.biometric')}</SectionHeader>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Ionicons name="finger-print-outline" size={22} color={p.primary} />
            <Text style={{ color: p.textMuted, fontSize: 13, flex: 1, lineHeight: 18 }}>{t('mob.biometricHint')}</Text>
            <Switch value={bioEnabled} onValueChange={toggleBiometric} trackColor={{ true: p.primary }} />
          </Card>
        </>
      )}

      <View style={{ height: 16 }} />
      <Pressable
        onPress={confirmLogout}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 }}
      >
        <Ionicons name="log-out-outline" size={20} color={p.danger} style={{ marginRight: 8 }} />
        <Text style={{ color: p.danger, fontSize: 16, fontWeight: '700' }}>{t('sidebar.signOut')}</Text>
      </Pressable>

      <Text style={{ color: p.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
        {t('mob.version', { v: Constants.expoConfig?.version ?? '1.0.0' })}
      </Text>
    </Screen>
  )
}
