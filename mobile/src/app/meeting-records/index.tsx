import React, { useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useT } from '../../i18n'
import { spacing, usePalette } from '../../theme'
import { useProfile } from '../../api/hooks'
import { useMinutesList, type MinutesRow } from '../../api/minutes'
import { Chip, EmptyState, ErrorView, Fab, GroupLabel, Screen, SegmentedTabs, SkeletonCards, StaleBanner } from '../../ui'
import { MinutesRowCard } from '../../ui/minutes'

export { ErrorBoundary } from '../../ui/ErrorScreen'

// Me → Meeting Records (§4.2, §8.1.1): the latest published minutes first,
// grouped by the month of the meeting. Meeting Minutes is the only category.
export default function MeetingRecords(): React.ReactElement {
  const { t, monthsLong } = useT()
  const p = usePalette()
  const router = useRouter()
  const profile = useProfile()
  const [year, setYear] = useState<number | undefined>(undefined)
  const list = useMinutesList(year)
  const all = useMinutesList()
  const secretary = profile.data?.permissions?.includes('minutes') === true

  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; rows: MinutesRow[] }> = []
    for (const row of list.data?.items ?? []) {
      const [y, m] = row.meeting_date.split('-')
      const key = `${y}-${m}`
      let g = out.find((x) => x.key === key)
      if (!g) {
        g = { key, label: `${monthsLong[Number(m) - 1] ?? m} ${y}`, rows: [] }
        out.push(g)
      }
      g.rows.push(row)
    }
    return out
  }, [list.data, monthsLong])

  const years = all.data?.years ?? []

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <Screen refreshing={list.isRefetching} onRefresh={() => { void list.refetch(); void all.refetch() }}>
        <SegmentedTabs options={[{ value: 'minutes', label: t('mob.mmCategoryMinutes') }]} value="minutes" onChange={() => {}} />
        {years.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
            <Chip label={t('mob.mmAllYears')} selected={year === undefined} onPress={() => setYear(undefined)} />
            {years.map((y) => <Chip key={y} label={String(y)} selected={year === y} onPress={() => setYear(y)} />)}
          </ScrollView>
        ) : <View style={{ height: spacing.md }} />}

        {list.isPending ? (
          <SkeletonCards cards={3} />
        ) : list.isError && !list.data ? (
          <ErrorView onRetry={() => void list.refetch()} />
        ) : (
          <>
            {list.isError ? <StaleBanner /> : null}
            {groups.length === 0 ? (
              <EmptyState icon="book-outline" text={t('mob.mmEmpty')} />
            ) : groups.map((g) => (
              <View key={g.key}>
                <GroupLabel>{g.label}</GroupLabel>
                {g.rows.map((row) => (
                  <MinutesRowCard key={row.id} row={row} onPress={() => router.push(`/meeting-records/${row.id}`)} />
                ))}
              </View>
            ))}
            <View style={{ height: secretary ? 88 : spacing.lg }} />
          </>
        )}
      </Screen>
      {secretary ? <Fab icon="create-outline" label={t('mob.mmPrepare')} onPress={() => router.push('/meeting-records/secretary')} /> : null}
    </View>
  )
}
