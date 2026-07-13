import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { api, errorMessage } from '../../api/client'
import { setEnrollToken } from '../../auth/enrollSession'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { Button, Input, Subtitle, Title } from '../../ui'

export default function Verify(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const [nic, setNic] = useState('')
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    if (!nic.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      setError(t('mob.verifySubtitle'))
      return
    }
    setBusy(true)
    try {
      const res = await api.post('/member-auth/verify-identity', {
        nic: nic.trim(),
        date_of_birth: dob.trim()
      })
      setEnrollToken(res.data.enroll_token)
      router.push('/(auth)/set-pin')
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
    } finally {
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
        <Title>{t('mob.verifyTitle')}</Title>
        <Subtitle>{t('mob.verifySubtitle')}</Subtitle>
        <Input
          label={t('mob.nic')}
          placeholder={t('mob.nicPlaceholder')}
          value={nic}
          onChangeText={setNic}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Input
          label={t('mob.dob')}
          placeholder={t('mob.dobPlaceholder')}
          value={dob}
          onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
        />
        {error !== '' && <Text style={{ color: p.danger, fontSize: 15, marginBottom: 10 }}>{error}</Text>}
        <Button label={t('mob.verify')} onPress={submit} loading={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
