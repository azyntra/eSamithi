import React, { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useCreateRequest, useSocietyInfo } from '../api/hooks'
import { errorMessage } from '../api/client'
import { formatCurrency } from '../lib/money'
import { Button, Callout, Input, ScalePressable, useCardStyle } from '../ui'

type ReqType = 'loan' | 'correction'

// New request (redesign §6.6.3): pick the kind with a big card, see the rules
// before typing, and get a clear "sent" state instead of a fleeting banner.
export default function NewRequest(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const card = useCardStyle()
  const create = useCreateRequest()
  const society = useSocietyInfo()

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
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
    }
  }

  const valid =
    type === 'loan'
      ? Number.isFinite(parseFloat(amount)) && parseFloat(amount) > 0 && purpose.trim().length > 0
      : message.trim().length > 0

  const maxLoan = society.data?.max_loan_limit ? Number(society.data.max_loan_limit) : null

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: p.successBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={44} color={p.success} />
        </View>
        <Text accessibilityLiveRegion="polite" style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginTop: spacing.lg, textAlign: 'center' }}>{t('mob.reqSubmitted')}</Text>
        <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', marginBottom: spacing.xl }}>{t('mob.reqWillReply')}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          <Button label={t('mob.reqBackToList')} onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const typeCard = (value: ReqType, icon: keyof typeof Ionicons.glyphMap, label: string, hint: string): React.ReactElement => {
    const selected = type === value
    return (
      <ScalePressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        haptic="selection"
        onPress={() => { setType(value); setError('') }}
        style={[card, { flex: 1, padding: spacing.md, gap: spacing.sm, borderWidth: selected ? 2 : 1, borderColor: selected ? p.primary : p.border }]}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selected ? p.primarySoft : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={22} color={selected ? p.primaryOnSoft : p.textMuted} />
        </View>
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
        <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{hint}</Text>
      </ScalePressable>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          {typeCard('loan', 'wallet-outline', t('mob.reqTypeLoan'), t('mob.reqLoanHint'))}
          {typeCard('correction', 'create-outline', t('mob.reqTypeCorrection'), t('mob.reqCorrectionHint'))}
        </View>

        {type === 'loan' ? (
          <>
            <Callout text={[maxLoan ? t('mob.reqMaxLoan', { amount: formatCurrency(maxLoan) }) : null, t('mob.reqPendingLimit')].filter(Boolean).join(' ')} />
            <Input label={t('mob.reqAmount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Rs. 10000" />
            <Input
              label={t('mob.reqPurpose')}
              value={purpose}
              onChangeText={setPurpose}
              placeholder={t('mob.reqPurposePh')}
              multiline
              numberOfLines={3}
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
          </>
        ) : (
          <Input label={t('mob.reqMessage')} value={message} onChangeText={setMessage} multiline numberOfLines={4} style={{ minHeight: 110, textAlignVertical: 'top' }} />
        )}

        {error !== '' ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: p.dangerBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md }}>
            <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
            <Text style={{ flex: 1, color: p.danger, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{error}</Text>
          </View>
        ) : null}
        <Button label={t('mob.reqSubmit')} icon="send-outline" onPress={submit} loading={create.isPending} disabled={!valid} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
