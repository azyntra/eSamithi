import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../i18n'
import { usePalette } from '../theme'
import { useCreateRequest } from '../api/hooks'
import { errorMessage } from '../api/client'
import { Banner, Button, Input, Segmented, Subtitle } from '../ui'

type ReqType = 'loan' | 'correction'

export default function NewRequest(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const router = useRouter()
  const create = useCreateRequest()

  const [type, setType] = useState<ReqType>('loan')
  const [amount, setAmount] = useState('')
  const [purpose, setPurpose] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    try {
      await create.mutateAsync(
        type === 'loan'
          ? { type, amount: Math.round(parseFloat(amount) * 100), purpose: purpose.trim() }
          : { type, message: message.trim() }
      )
      setDone(true)
      setTimeout(() => router.back(), 1600)
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
    }
  }

  const valid =
    type === 'loan'
      ? Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0 && purpose.trim().length > 0
      : message.trim().length > 0

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        {done ? (
          <Banner kind="success" text={t('mob.reqSubmitted')} />
        ) : (
          <>
            <Segmented<ReqType>
              options={[
                { value: 'loan', label: t('mob.reqTypeLoan') },
                { value: 'correction', label: t('mob.reqTypeCorrection') }
              ]}
              value={type}
              onChange={setType}
            />
            <Subtitle> </Subtitle>

            {type === 'loan' ? (
              <>
                <Input
                  label={t('mob.reqAmount')}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="10000"
                />
                <Input
                  label={t('mob.reqPurpose')}
                  value={purpose}
                  onChangeText={setPurpose}
                  multiline
                  numberOfLines={3}
                  style={{ minHeight: 80, textAlignVertical: 'top' }}
                />
              </>
            ) : (
              <Input
                label={t('mob.reqMessage')}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                style={{ minHeight: 100, textAlignVertical: 'top' }}
              />
            )}

            {error !== '' && <Text style={{ color: p.danger, fontSize: 15, marginBottom: 10 }}>{error}</Text>}
            <Button label={t('mob.reqSubmit')} onPress={submit} loading={create.isPending} disabled={!valid} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
