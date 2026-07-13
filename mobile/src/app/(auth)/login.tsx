import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text } from 'react-native'
import { useRouter } from 'expo-router'
import axios from 'axios'
import { api, errorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Banner, Button, Input, Subtitle, Title } from '../../ui'

export default function Login(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const { signInWithTokens } = useAuth()
  const [nic, setNic] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [notSetUp, setNotSetUp] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    setNotSetUp(false)
    setBusy(true)
    try {
      const res = await api.post('/member-auth/login', { nic: nic.trim(), pin })
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
        <Input
          label={t('mob.nic')}
          placeholder={t('mob.nicPlaceholder')}
          value={nic}
          onChangeText={setNic}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Input
          label={t('mob.pin')}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        {notSetUp && (
          <>
            <Banner kind="warning" text={t('mob.notSetUp')} />
            <Button label={t('mob.setUpNow')} variant="secondary" onPress={() => router.push('/(auth)/verify')} />
            <Text style={{ height: 10 }} />
          </>
        )}
        {error !== '' && <Text style={{ color: p.danger, fontSize: 15, marginBottom: 10 }}>{error}</Text>}
        <Button label={t('mob.login')} onPress={submit} loading={busy} disabled={!nic.trim() || pin.length < 4} />
        <Pressable onPress={() => router.push('/(auth)/verify')} style={{ paddingVertical: 18, alignItems: 'center' }}>
          <Text style={{ color: p.primary, fontSize: 15, fontWeight: '600' }}>{t('mob.forgotPin')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
