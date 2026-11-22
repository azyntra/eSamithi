import React from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { useAttendanceEvents, type AttendanceEvent } from '../../api/hooks'
import { dayLabelKey } from '../../lib/attendance'
import { formatDate } from '../../lib/date'
import { Button, Callout, Card, EmptyState, ErrorView, ListRow, Screen, SkeletonCards, StaleBanner } from '../../ui'

// Mark Attendance — the events open for marking from a phone (yesterday,
// today, tomorrow). Reached only by attendance staff; the server refuses
// everyone else, and the guard in useAttendanceGuard sends them home.
export default function AttendanceEvents(): React.ReactElement {
  const { t } = useT()
  const router = useRouter()
  const events = useAttendanceEvents()

  if (events.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (events.isError && !events.data) {
    return (
      <Screen refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
        <ErrorView onRetry={() => events.refetch()} />
      </Screen>
    )
  }

  const { today, events: rows } = events.data!
  const typeLabel = (e: AttendanceEvent) =>
    e.type === 'funeral' ? t('mob.attTypeFuneral') : e.type === 'meeting' ? t('mob.attTypeMeeting') : t('mob.attTypeOther')
  const whenLabel = (e: AttendanceEvent) => {
    const key = dayLabelKey(e.event_date, today)
    return key ? t(key) : formatDate(e.event_date)
  }

  return (
    <Screen refreshing={events.isRefetching} onRefresh={() => events.refetch()}>
      {events.isError && <StaleBanner />}
      <Callout icon="scan-outline" tone="brand" text={t('mob.attEventsIntro')} />
      <Button label={t('mob.attNewEvent')} icon="add-circle-outline" onPress={() => router.push('/attendance/new')} />
      <View style={{ height: 16 }} />
      {rows.length === 0 ? (
        <EmptyState icon="calendar-outline" text={t('mob.attNoEvents')} />
      ) : (
        <Card>
          {rows.map((e, i) => (
            <ListRow
              key={e.id}
              first={i === 0}
              icon={e.type === 'funeral' ? 'flower-outline' : e.type === 'meeting' ? 'people-outline' : 'calendar-outline'}
              iconTone={e.type === 'funeral' ? 'memorial' : e.type === 'meeting' ? 'brand' : 'warning'}
              label={e.title}
              sublabel={`${typeLabel(e)} · ${whenLabel(e)} · ${t('mob.attPresentCount', { count: e.attendee_count ?? 0 })}`}
              onPress={() => router.push({ pathname: '/attendance/[id]', params: { id: String(e.id) } })}
            />
          ))}
        </Card>
      )}
    </Screen>
  )
}
