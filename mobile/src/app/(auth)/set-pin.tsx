import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { api, errorMessage } from '../../api/client'
import { getEnrollToken, setEnrollToken } from '../../auth/enrollSession'
import { useAuth } from '../../auth/AuthContext'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Button, Subtitle, Title } from '../../ui'
import { PinDots, PinPad } from '../../ui/auth'
import { useType } from '../../typography'

export default function SetPin(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const { signInWithTokens } = useAuth()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // Step 1 chooses the PIN, step 2 repeats it
  const [confirming, setConfirming] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    if (pin !== confirm) {
      setError(t('mob.pinMismatch'))
      // Start again from the first PIN
      setPin('')
      setConfirm('')
      setConfirming(false)
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
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
      <Title>{t('mob.setPinTitle')}</Title>
      <Subtitle>{confirming ? t('mob.pinStepConfirm') : t('mob.pinStepChoose')}</Subtitle>
      <PinDots value={confirming ? confirm : pin} error={error !== ''} />
      {error !== '' && <Text accessibilityLiveRegion="polite" style={{ color: p.danger, fontSize: 16, marginBottom: 10, textAlign: 'center', fontFamily: ty.family.semibold, lineHeight: ty.lh(16) }}>{error}</Text>}
      <PinPad value={confirming ? confirm : pin} onChange={(v) => { setError(''); if (confirming) setConfirm(v); else setPin(v) }} />
      <View style={{ height: 20 }} />
      {confirming ? (
        <Button label={t('mob.savePin')} onPress={submit} loading={busy} disabled={confirm.length < 4} />
      ) : (
        <Button label={t('mob.continue')} onPress={() => setConfirming(true)} disabled={pin.length < 4} />
      )}
    </ScrollView>
  )
}
