import React from 'react'
import { Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { usePalette } from '../../theme'
import { useAnnouncements, type Announcement } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { Card, EmptyState, ErrorView, Row, Screen, SkeletonCards, StaleBanner } from '../../ui'

export function noticeMeta(type: Announcement['type'], t: ReturnType<typeof useT>['t'], p: ReturnType<typeof usePalette>): {
  icon: 'flower-outline' | 'calendar-outline' | 'megaphone-outline'
  label: string
  color: string
} {
  if (type === 'death') return { icon: 'flower-outline', label: t('mob.noticeDeath'), color: p.danger }
  if (type === 'meeting') return { icon: 'calendar-outline', label: t('mob.noticeMeeting'), color: p.primary }
  return { icon: 'megaphone-outline', label: t('mob.noticeGeneral'), color: p.success }
}

export default function Notices(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const notices = useAnnouncements()

  if (notices.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (notices.isError && !notices.data) {
    return (
      <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
        <ErrorView onRetry={() => notices.refetch()} />
      </Screen>
    )
  }

  const rows = notices.data!

  return (
    <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
      {notices.isError && <StaleBanner />}
      {rows.length === 0 && <EmptyState icon="notifications-outline" text={t('mob.noNotices')} />}
      {rows.map((n) => {
        const meta = noticeMeta(n.type, t, p)
        return (
          <Card key={n.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
              <Text style={{ color: meta.color, fontSize: 13, fontWeight: '700', flex: 1 }}>{meta.label}</Text>
              <Text style={{ color: p.textMuted, fontSize: 12, flexShrink: 0, paddingRight: 2 }}>{formatDate(n.created_at)}</Text>
            </View>
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginBottom: 4 }}>{n.title}</Text>
            {n.type === 'death' && n.deceased_name && (
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>{n.deceased_name}</Text>
            )}
            {n.body ? <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 6 }}>{n.body}</Text> : null}
            {n.type === 'death' && (n.funeral_date || n.funeral_location) && (
              <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: 4 }}>
                {n.funeral_date && <Row label={t('mob.funeralDate')} value={formatDate(n.funeral_date)} />}
                {n.funeral_location && <Row label={t('mob.funeralLocation')} value={n.funeral_location} />}
              </View>
            )}
            {n.type === 'meeting' && n.event_date && (
              <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: 4 }}>
                <Row label={t('mob.meetingDate')} value={formatDate(n.event_date)} />
              </View>
            )}
          </Card>
        )
      })}
    </Screen>
  )
}
