import React, { useEffect, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { spacing, type as typeScale, usePalette } from '../../theme'
import { useType } from '../../typography'
import { useAnnouncements, type Announcement } from '../../api/hooks'
import { useNoticesSeen } from '../../lib/noticesSeen'
import { Chip, EmptyState, ErrorView, ListScreen, PageTitle, Screen, SkeletonCards, StaleBanner } from '../../ui'
import { NoticeCard } from '../../ui/NoticeCard'

// Notices (redesign §6.4): newest first, death notices in the calm memorial
// treatment, each opening its own detail screen. Old notices leave by
// themselves (server-side retention, 5abcf016) and the footer says so.

type Filter = 'all' | Announcement['type']

export default function Notices(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const notices = useAnnouncements()
  const { markSeen } = useNoticesSeen()
  const [filter, setFilter] = useState<Filter>('all')

  // Opening this tab clears the unread badge (watermark = highest id loaded)
  useEffect(() => {
    if (notices.data && notices.data.length > 0) {
      markSeen(Math.max(...notices.data.map((n) => n.id)))
    }
  }, [notices.data, markSeen])

  if (notices.isPending) {
    return (
      <Screen>
        <PageTitle title={t('mob.tabNotices')} />
        <SkeletonCards cards={3} />
      </Screen>
    )
  }
  if (notices.isError && !notices.data) {
    return (
      <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
        <PageTitle title={t('mob.tabNotices')} />
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
    <ListScreen
      data={rows}
      keyExtractor={(n: Announcement) => String(n.id)}
      renderItem={(n: Announcement) => <NoticeCard notice={n} onPress={() => router.push(`/notice/${n.id}`)} />}
      refreshing={notices.isRefetching}
      onRefresh={() => notices.refetch()}
      header={
        <View>
          <PageTitle title={t('mob.tabNotices')} />
          {notices.isError && <StaleBanner />}
          {all.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }} contentContainerStyle={{ gap: spacing.sm }}>
              {chips.map((chip) => (
                <Chip key={chip.value} label={chip.label} selected={filter === chip.value} onPress={() => setFilter(chip.value)} />
              ))}
            </ScrollView>
          )}
        </View>
      }
      footer={
        all.length > 0 ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), textAlign: 'center', marginTop: spacing.sm }}>
            {t('mob.noticesExpireNote')}
          </Text>
        ) : undefined
      }
      empty={
        all.length === 0
          ? <EmptyState icon="notifications-off-outline" text={t('mob.noNotices')} />
          : <EmptyState icon="filter-outline" text={t('mob.noNotices')} />
      }
    />
  )
}
