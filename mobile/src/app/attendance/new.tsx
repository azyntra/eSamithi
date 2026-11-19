import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useType } from '../../typography'
import { useAttendanceEvents, useCreateAttendanceEvent, type AttendanceEventType, type AttendanceMode } from '../../api/hooks'
import { classifyMarkError, windowDates } from '../../lib/attendance'
import { Button, Input, Screen, SectionHeader, Segmented, useToast } from '../../ui'

// Create an event from the phone (requirements FR-3.2): a funeral is often
// announced when the office is closed. The date can only be yesterday, today
// or tomorrow — the same window the server enforces.
export default function NewAttendanceEvent(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const toast = useToast()
  const events = useAttendanceEvents()
  const create = useCreateAttendanceEvent()

  const today = events.data?.today ?? new Date().toISOString().slice(0, 10)
  const dates = windowDates(today)
  const [type, setType] = useState<AttendanceEventType>('funeral')
  const [title, setTitle] = useState('')
  const [day, setDay] = useState<'yesterday' | 'today' | 'tomorrow'>('today')
  const [mode, setMode] = useState<AttendanceMode>('present')
  const [error, setError] = useState<string | undefined>()

  const submit = async (): Promise<void> => {
    if (!title.trim()) {
      setError(t('mob.attTitleRequired'))
      return
    }
    try {
      const res = await create.mutateAsync({ type, title: title.trim(), event_date: dates[day], attendance_mode: mode })
      toast.show('success', t('mob.attCreated'))
      router.replace({ pathname: '/attendance/[id]', params: { id: String(res.id) } })
    } catch (err) {
      const f = classifyMarkError(err)
      toast.show('error', f.kind === 'not_staff' ? t('mob.attNotStaff') : f.kind === 'offline' ? t('mob.errorLoad') : f.kind === 'other' ? f.message : t('mob.errorLoad'))
      if (f.kind === 'not_staff') router.replace('/')
    }
  }

  return (
    <Screen>
      <SectionHeader>{t('mob.attType')}</SectionHeader>
      <Segmented<AttendanceEventType>
        options={[
          { value: 'funeral', label: t('mob.attTypeFuneral') },
          { value: 'meeting', label: t('mob.attTypeMeeting') },
          { value: 'other', label: t('mob.attTypeOther') }
        ]}
        value={type}
        onChange={setType}
      />
      <View style={{ height: 16 }} />
      <Input
        label={t('mob.attEventTitle')}
        value={title}
        onChangeText={(v) => { setTitle(v); setError(undefined) }}
        placeholder={t('mob.attTitlePh')}
        maxLength={255}
        error={error}
      />
      <SectionHeader>{t('mob.attDate')}</SectionHeader>
      <Segmented<'yesterday' | 'today' | 'tomorrow'>
        options={[
          { value: 'yesterday', label: t('mob.attYesterday') },
          { value: 'today', label: t('mob.attToday') },
          { value: 'tomorrow', label: t('mob.attTomorrow') }
        ]}
        value={day}
        onChange={setDay}
      />
      <SectionHeader>{t('mob.attMethod')}</SectionHeader>
      <Segmented<AttendanceMode>
        options={[
          { value: 'present', label: t('mob.attModePresent') },
          { value: 'absent', label: t('mob.attModeAbsent') }
        ]}
        value={mode}
        onChange={setMode}
      />
      <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14), marginTop: 8 }}>
        {mode === 'present' ? t('mob.attModePresentHint') : t('mob.attModeAbsentHint')}
      </Text>
      <View style={{ height: 24 }} />
      <Button label={t('mob.attCreate')} icon="checkmark-circle-outline" onPress={submit} loading={create.isPending} />
    </Screen>
  )
}
