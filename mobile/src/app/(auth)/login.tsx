import React, { useEffect, useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import axios from 'axios'
import { api, errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { forgetNic, loadRememberedNic, maskNic, rememberNic } from '../../lib/rememberedNic'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Banner, Button, Input, Subtitle, Title } from '../../ui'
import { PinDots, PinPad } from '../../ui/auth'
import { useType } from '../../typography'

export default function Login(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const { signInWithTokens, pendingProfile, activeProfile } = useAuth()
  const slug = pendingProfile?.slug ?? activeProfile?.slug
  // A returning member's NIC, shown masked; null = type it
  const [remembered, setRemembered] = useState<string | null>(null)
  const [nic, setNic] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [notSetUp, setNotSetUp] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    loadRememberedNic(slug).then((v) => {
      if (live && v) { setRemembered(v); setNic(v) }
    })
    return () => { live = false }
  }, [slug])

  const submit = async (): Promise<void> => {
    setError('')
    setNotSetUp(false)
    setBusy(true)
    try {
      const res = await api.post('/member-auth/login', { nic: nic.trim(), pin })
      rememberNic(slug, nic)
      await signInWithTokens(res.data.token, res.data.refresh_token)
    } catch (err) {
      // §1.7 — a member without a PIN gets a friendly setup path, not an error
      if (axios.isAxiosError(err) && (err.response?.data as { code?: string } | undefined)?.code === 'NO_PIN') {
        setNotSetUp(true)
      } else {
        setError(errorMessage(err, t('mob.errorLoad')))
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Title>{t('mob.loginTitle')}</Title>
        <Subtitle>{t('mob.loginSubtitle')}</Subtitle>
        {remembered ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, borderRadius: 14, paddingHorizontal: 16, minHeight: 56, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: ty.family.regular, lineHeight: ty.lh(12) }}>{t('mob.nic')}</Text>
              <Text style={{ color: p.text, fontSize: 16, fontFamily: ty.family.semibold, lineHeight: ty.lh(16) }}>{maskNic(remembered)}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => { forgetNic(slug); setRemembered(null); setNic(''); setPin('') }}
              style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 }}
            >
              <Text style={{ color: p.primary, fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14) }}>{t('mob.notYou')}</Text>
            </Pressable>
          </View>
        ) : (
          <Input
            label={t('mob.nic')}
            placeholder={t('mob.nicPlaceholder')}
            value={nic}
            onChangeText={(v) => { setNic(v.toUpperCase().replace(/[^0-9VX]/g, '')); setError('') }}
            maxLength={12}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        )}
        <Text style={{ color: p.text, fontSize: 16, fontFamily: ty.family.semibold, lineHeight: ty.lh(16) }}>{t('mob.pin')}</Text>
        <PinDots value={pin} error={error !== ''} />
        <PinPad value={pin} onChange={(v) => { Keyboard.dismiss(); setPin(v); setError('') }} />
        <View style={{ height: 20 }} />
        {notSetUp && (
          <>
            <Banner kind="warning" text={t('mob.notSetUp')} />
            <Button label={t('mob.setUpNow')} variant="secondary" onPress={() => router.push('/(auth)/verify')} />
            <View style={{ height: 10 }} />
          </>
        )}
        {error !== '' && <Text accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 16, marginBottom: 10, textAlign: 'center', fontFamily: ty.family.semibold, lineHeight: ty.lh(16) }}>{error}</Text>}
        <Button label={t('mob.login')} onPress={submit} loading={busy} disabled={!nic.trim() || pin.length < 4} />
        <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/verify')} style={{ minHeight: 56, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: p.primary, fontSize: 16, fontFamily: ty.family.semibold, lineHeight: ty.lh(16) }}>{t('mob.forgotPin')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
