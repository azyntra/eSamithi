import React, { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../i18n'
import { radius, spacing, usePalette } from '../theme'
import { uuid4 } from '../lib/attendance'
import { errorMessage } from '../api/client'
import { minutesApi, putDraft, type MinutesDraft } from '../api/minutes'
import { Button, Chip, Input } from './index'
import { DateField } from './auth'
import { MText } from './minutes'

// Today on the phone's calendar, as YYYY-MM-DD
export function todayYmd(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Step 1 of new minutes (§8.2.2): a title and the date of the meeting. The
// draft exists from here on and can be continued any time. Shown inside the
// draft screen itself, which then becomes the editor in place: no screen
// change at the moment the draft is created.
export function NewMinutesForm({ onCreated }: { onCreated: (draft: MinutesDraft) => void }): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  // Minutes are nearly always written up on or soon after the meeting day
  const [date, setDate] = useState(todayYmd)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // A double tap, or a retry after a timeout, creates one draft
  const ref = useRef(uuid4())

  const suggestions = [t('mob.mmSuggestMonthly'), t('mob.mmSuggestAnnual'), t('mob.mmSuggestSpecial')]

  const create = async (): Promise<void> => {
    setError('')
    if (!title.trim() || !date) return
    setBusy(true)
    try {
      const draft = await minutesApi.create({ client_ref: ref.current, title: title.trim(), meeting_date: date })
      putDraft(qc, draft)
      void qc.invalidateQueries({ queryKey: ['me', 'minutes', 'hub'] })
      setBusy(false)
      onCreated(draft)
    } catch (err) {
      setError(errorMessage(err, t('mob.errorLoad')))
      setBusy(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <MText color={p.textMuted}>{t('mob.mmNewIntro')}</MText>
        <Input label={t('mob.mmReportTitle')} value={title} onChangeText={(v) => { setTitle(v); setError('') }} maxLength={200} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.sm }}>
          {suggestions.map((s) => <Chip key={s} label={s} selected={title === s} onPress={() => setTitle(s)} />)}
        </View>
        <DateField label={t('mob.mmMeetingDate')} value={date} onChange={(v) => { setDate(v); setError('') }} />
        {error ? (
          <View accessibilityLiveRegion="polite" style={{ backgroundColor: p.dangerBg, borderRadius: radius.sm, padding: spacing.md }}>
            <MText size="caption" weight="semibold" color={p.danger}>{error}</MText>
          </View>
        ) : null}
        <Button label={t('mob.mmCreateDraft')} icon="arrow-forward" loading={busy} disabled={!title.trim() || !date} onPress={() => void create()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
