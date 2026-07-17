import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useAnnouncements, type Announcement } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { useNoticesSeen } from '../../lib/noticesSeen'
import { Card, EmptyState, ErrorView, Row, ScalePressable, Screen, SkeletonCards, StaleBanner } from '../../ui'

export function noticeMeta(type: Announcement['type'], t: ReturnType<typeof useT>['t'], p: ReturnType<typeof usePalette>): {
  icon: 'flower-outline' | 'calendar-outline' | 'megaphone-outline'
  label: string
  color: string
} {
  if (type === 'death') return { icon: 'flower-outline', label: t('mob.noticeDeath'), color: p.danger }
  if (type === 'meeting') return { icon: 'calendar-outline', label: t('mob.noticeMeeting'), color: p.primary }
  return { icon: 'megaphone-outline', label: t('mob.noticeGeneral'), color: p.success }
}

type Filter = 'all' | Announcement['type']

export default function Notices(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const notices = useAnnouncements()
  const { markSeen } = useNoticesSeen()
  const [filter, setFilter] = useState<Filter>('all')

  // Opening this tab clears the unread badge (watermark = highest id loaded)
  useEffect(() => {
    if (notices.data && notices.data.length > 0) {
      markSeen(Math.max(...notices.data.map((n) => n.id)))
    }
  }, [notices.data, markSeen])

  if (notices.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (notices.isError && !notices.data) {
    return (
      <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
        <ErrorView onRetry={() => notices.refetch()} />
      </Screen>
    )
  }

  const all = notices.data!
  const rows = filter === 'all' ? all : all.filter((n) => n.type === filter)

  const chips: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('mob.filterAll') },
    { value: 'death', label: t('mob.noticeDeath') },
    { value: 'meeting', label: t('mob.noticeMeeting') },
    { value: 'general', label: t('mob.noticeGeneral') }
  ]

  return (
    <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
      {notices.isError && <StaleBanner />}

      {all.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg - 2 }} contentContainerStyle={{ gap: spacing.sm }}>
          {chips.map((chip) => {
            const selected = filter === chip.value
            return (
              <ScalePressable
                key={chip.value}
                onPress={() => setFilter(chip.value)}
                accessibilityRole="button"
                accessibilityState={selected ? { selected: true } : {}}
                haptic="selection"
                scaleTo={0.94}
                style={{
                  paddingHorizontal: spacing.lg - 2,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  backgroundColor: selected ? p.primary : p.primarySoft
                }}
              >
                <Text style={{ color: selected ? p.onPrimary : p.primary, fontSize: 13, fontFamily: ty.family.bold, lineHeight: ty.lh(13) }}>
                  {chip.label}
                </Text>
              </ScalePressable>
            )
          })}
        </ScrollView>
      )}

      {all.length === 0 && <EmptyState icon="notifications-outline" text={t('mob.noNotices')} />}
      {all.length > 0 && rows.length === 0 && <EmptyState icon="filter-outline" text={t('mob.noNotices')} />}

      {rows.map((n) => {
        const meta = noticeMeta(n.type, t, p)
        return (
          <Card key={n.id} style={{ borderLeftWidth: 4, borderLeftColor: meta.color }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
              <Text style={{ color: meta.color, fontSize: 13, fontFamily: ty.family.bold, lineHeight: ty.lh(13), flex: 1 }}>{meta.label}</Text>
              <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: interFamily.regular, flexShrink: 0, paddingRight: 2 }}>
                {formatDate(n.created_at)}
              </Text>
            </View>
            <Text style={{ color: p.text, fontSize: 17, fontFamily: ty.family.bold, lineHeight: ty.lh(17), marginBottom: spacing.xs }}>{n.title}</Text>
            {n.type === 'death' && n.deceased_name && (
              <Text style={{ color: p.text, fontSize: 15, fontFamily: ty.family.semibold, lineHeight: ty.lh(15), marginBottom: spacing.xs }}>
                {n.deceased_name}
              </Text>
            )}
            {n.body ? (
              <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14), marginBottom: spacing.sm - 2 }}>
                {n.body}
              </Text>
            ) : null}
            {n.type === 'death' && (n.funeral_date || n.funeral_location) && (
              <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: spacing.xs }}>
                {n.funeral_date && <Row label={t('mob.funeralDate')} value={formatDate(n.funeral_date)} />}
                {n.funeral_location && <Row label={t('mob.funeralLocation')} value={n.funeral_location} />}
              </View>
            )}
            {n.type === 'meeting' && n.event_date && (
              <View style={{ borderTopWidth: 1, borderTopColor: p.border, marginTop: spacing.xs }}>
                <Row label={t('mob.meetingDate')} value={formatDate(n.event_date)} />
              </View>
            )}
          </Card>
        )
      })}
    </Screen>
  )
}
