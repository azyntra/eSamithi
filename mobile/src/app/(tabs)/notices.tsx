import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import { useAnnouncements, type Announcement } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { useNoticesSeen } from '../../lib/noticesSeen'
import { Card, Chip, EmptyState, ErrorView, ListScreen, Row, Screen, SkeletonCards, StaleBanner } from '../../ui'

export function noticeMeta(type: Announcement['type'], t: ReturnType<typeof useT>['t'], p: ReturnType<typeof usePalette>): {
  icon: 'flower-outline' | 'calendar-outline' | 'megaphone-outline'
  label: string
  color: string
  bg: string
} {
  if (type === 'death') return { icon: 'flower-outline', label: t('mob.noticeDeath'), color: p.danger, bg: p.dangerBg }
  if (type === 'meeting') return { icon: 'calendar-outline', label: t('mob.noticeMeeting'), color: p.primaryOnSoft, bg: p.primarySoft }
  return { icon: 'megaphone-outline', label: t('mob.noticeGeneral'), color: p.success, bg: p.successBg }
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

  // The whole archive used to render into one ScrollView. It is a list now.
  const noticeCard = (n: Announcement): React.ReactElement => {
    const meta = noticeMeta(n.type, t, p)
    return (
      <Card key={n.id}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: radius.pill, backgroundColor: meta.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={meta.icon} size={17} color={meta.color} />
          </View>
          <Text style={{ color: meta.color, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14), flex: 1 }}>{meta.label}</Text>
          <Text style={{ color: p.textMuted, fontSize: 12, fontFamily: interFamily.regular, flexShrink: 0, paddingRight: 2 }}>
            {formatDate(n.created_at)}
          </Text>
        </View>
        <Text style={{ color: p.text, fontSize: 18, fontFamily: ty.family.bold, lineHeight: ty.lh(18), marginBottom: spacing.xs }}>{n.title}</Text>
        {n.type === 'death' && n.deceased_name && (
          <Text style={{ color: p.text, fontSize: 16, fontFamily: ty.family.semibold, lineHeight: ty.lh(16), marginBottom: spacing.xs }}>
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
  }

  return (
    <ListScreen
      data={rows}
      keyExtractor={(n: Announcement) => String(n.id)}
      renderItem={(n: Announcement) => noticeCard(n)}
      refreshing={notices.isRefetching}
      onRefresh={() => notices.refetch()}
      header={
        <>
          {notices.isError && <StaleBanner />}
          {all.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg - 2 }} contentContainerStyle={{ gap: spacing.sm }}>
              {chips.map((chip) => (
                <Chip key={chip.value} label={chip.label} selected={filter === chip.value} onPress={() => setFilter(chip.value)} />
              ))}
            </ScrollView>
          )}
        </>
      }
      empty={
        all.length === 0
          ? <EmptyState icon="notifications-off-outline" text={t('mob.noNotices')} />
          : <EmptyState icon="filter-outline" text={t('mob.noNotices')} />
      }
    />
  )
}
