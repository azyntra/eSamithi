import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { api, errorMessage } from '../../api/client'
import { getEnrollToken, setEnrollToken } from '../../auth/enrollSession'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Button, Input, Subtitle, Title } from '../../ui'

export default function SetPin(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const { signInWithTokens } = useAuth()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    if (pin !== confirm) {
      setError(t('mob.pinMismatch'))
      return
    }
    const enrollToken = getEnrollToken()
    if (!enrollToken) {
      // Token expired or app restarted mid-flow — send them back to verify
      router.replace('/(auth)/verify')
      return
    }
    setBusy(true)
    try {
      const res = await api.post(
        '/member-auth/set-pin',
        { pin },
        { headers: { Authorization: `Bearer ${enrollToken}` } }
      )
      setEnrollToken(null)
      await signInWithTokens(res.data.token, res.data.refresh_token)
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Title>{t('mob.setPinTitle')}</Title>
        <Subtitle>{t('mob.setPinSubtitle')}</Subtitle>
        <Input
          label={t('mob.pin')}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        <Input
          label={t('mob.confirmPin')}
          value={confirm}
          onChangeText={setConfirm}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
        />
        {error !== '' && <Text style={{ color: p.danger, fontSize: 15, marginBottom: 10 }}>{error}</Text>}
        <Button label={t('mob.savePin')} onPress={submit} loading={busy} disabled={pin.length < 4} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
