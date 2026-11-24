import React, { useState } from 'react'
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useCreateRequest } from '../api/hooks'
import { errorMessage } from '../api/client'
import { Button, Callout, Input, ScalePressable, useCardStyle } from '../ui'

type Category = 'child_safety' | 'content' | 'other'

// Report a concern — the in-app reporting mechanism required by Google Play's
// Child Safety Standards policy. A report reaches the society's officers as a
// member request of type 'concern' (never held back by the pending-request
// limit) and is answered under My requests. Opened from Me, Help and every
// Puruka post (which pre-fills the post).
export default function Report(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const card = useCardStyle()
  const create = useCreateRequest()
  const params = useLocalSearchParams<{ category?: string; ref?: string }>()

  const [category, setCategory] = useState<Category | null>(
    params.category === 'child_safety' || params.category === 'content' || params.category === 'other' ? params.category : null
  )
  const [message, setMessage] = useState(params.ref ? `${params.ref}\n` : '')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (): Promise<void> => {
    setError('')
    if (!category || !message.trim()) return
    try {
      await create.mutateAsync({ type: 'concern', purpose: category, message: message.trim() })
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
    }
  }

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: p.successBg, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={44} color={p.success} />
        </View>
        <Text accessibilityLiveRegion="polite" style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), marginTop: spacing.lg, textAlign: 'center' }}>{t('mob.reportSent')}</Text>
        <Text style={{ color: p.textMuted, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body), textAlign: 'center', marginBottom: spacing.xl }}>{t('mob.reqWillReply')}</Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
          <Button label={t('mob.requests')} onPress={() => router.replace('/requests')} />
          <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
        </View>
      </View>
    )
  }

  const option = (value: Category, icon: keyof typeof Ionicons.glyphMap, label: string, hint: string): React.ReactElement => {
    const selected = category === value
    return (
      <ScalePressable
        key={value}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        haptic="selection"
        onPress={() => { setCategory(value); setError('') }}
        style={[card, { padding: spacing.md + 2, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm + 2, borderWidth: selected ? 2 : 1, borderColor: selected ? p.primary : p.border }]}
      >
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: selected ? p.primarySoft : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={22} color={selected ? p.primaryOnSoft : p.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{label}</Text>
          <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{hint}</Text>
        </View>
        <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? p.primary : p.textMuted} />
      </ScalePressable>
    )
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }} keyboardShouldPersistTaps="handled">
        <Callout icon="shield-checkmark-outline" tone="brand" text={t('mob.reportIntro')} />

        <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading), marginBottom: spacing.sm }}>{t('mob.reportWhat')}</Text>
        {option('child_safety', 'shield-outline', t('mob.reportChildSafety'), t('mob.reportChildSafetyHint'))}
        {option('content', 'flag-outline', t('mob.reportContent'), t('mob.reportContentHint'))}
        {option('other', 'chatbubble-ellipses-outline', t('mob.reportOther'), t('mob.reportOtherHint'))}

        {category === 'child_safety' ? (
          <View style={{ backgroundColor: p.dangerBg, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.xs, marginBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Ionicons name="call-outline" size={20} color={p.danger} />
              <Text style={{ flex: 1, color: p.danger, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{t('mob.reportUrgent')}</Text>
            </View>
            <ScalePressable accessibilityRole="button" onPress={() => { Linking.openURL('tel:1929').catch(() => {}) }} style={{ minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start', marginLeft: spacing.xl + spacing.sm }}>
              <Text style={{ color: p.danger, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body), textDecorationLine: 'underline' }}>{t('mob.call1929')}</Text>
            </ScalePressable>
          </View>
        ) : null}

        <View style={{ height: spacing.md }} />
        <Input
          label={t('mob.reportDescribe')}
          value={message}
          onChangeText={(v) => { setMessage(v); setError('') }}
          placeholder={t('mob.reportDescribePh')}
          multiline
          numberOfLines={5}
          style={{ minHeight: 120, textAlignVertical: 'top' }}
          maxLength={2000}
        />

        {error !== '' ? (
          <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', gap: spacing.sm, backgroundColor: p.dangerBg, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md }}>
            <Ionicons name="alert-circle-outline" size={20} color={p.danger} />
            <Text style={{ flex: 1, color: p.danger, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption) }}>{error}</Text>
          </View>
        ) : null}
        <Button label={t('mob.reportSend')} icon="send-outline" onPress={submit} loading={create.isPending} disabled={!category || !message.trim()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
