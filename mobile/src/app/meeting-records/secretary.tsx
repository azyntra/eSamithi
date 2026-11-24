import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../../i18n'
import { spacing, usePalette } from '../../theme'
import { formatDate } from '../../lib/date'
import { errorCode, formatDuration, minutesApi, putDraft, useSecretaryHub } from '../../api/minutes'
import { useProfile } from '../../api/hooks'
import { Button, Callout, ErrorView, GroupLabel, ListRow, Screen, SkeletonCards, useCardStyle, useToast } from '../../ui'
import { MinutesRowCard, MText } from '../../ui/minutes'

// The Secretary's starting point (§8.2.1): drafts to continue, published
// minutes to update, comments waiting for an answer.
export default function SecretaryHub(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const card = useCardStyle()
  const router = useRouter()
  const toast = useToast()
  const qc = useQueryClient()
  const profile = useProfile()
  const isSecretary = profile.data?.permissions?.includes('minutes') === true
  const hub = useSecretaryHub(isSecretary)
  const [busy, setBusy] = useState<number | null>(null)

  // Reassigned while away: say so once and leave (§9)
  useEffect(() => {
    if (hub.isError && errorCode(hub.error) === 'NOT_SECRETARY') {
      toast.show('info', t('mob.mmNotSecretary'))
      void qc.invalidateQueries({ queryKey: ['me', 'profile'] })
      router.back()
    }
  }, [hub.isError, hub.error, qc, router, t, toast])

  if (profile.isPending || (isSecretary && hub.isPending)) return <Screen><SkeletonCards cards={3} /></Screen>
  if (!isSecretary) {
    return (
      <Screen>
        <Callout icon="lock-closed-outline" tone="warning" text={t('mob.mmNotSecretary')} />
      </Screen>
    )
  }
  if (hub.isError || !hub.data) return <Screen><ErrorView onRetry={() => void hub.refetch()} /></Screen>

  const update = async (reportId: number): Promise<void> => {
    setBusy(reportId)
    try {
      putDraft(qc, await minutesApi.startRevision(reportId))
      router.push(`/meeting-records/draft/${reportId}`)
    } catch {
      toast.show('error', t('mob.errorLoad'))
    } finally {
      setBusy(null)
    }
  }

  const { drafts, published, open_comments } = hub.data
  return (
    <Screen refreshing={hub.isRefetching} onRefresh={() => void hub.refetch()}>
      <Button label={t('mob.mmNewMinutes')} icon="add-circle-outline" onPress={() => router.push('/meeting-records/new')} />
      <MText size="caption" color={p.textMuted} style={{ marginTop: spacing.sm }}>{t('mob.mmHubIntro')}</MText>

      {drafts.length > 0 ? (
        <>
          <GroupLabel>{t('mob.mmDrafts')}</GroupLabel>
          <View style={[card, { paddingVertical: 0 }]}>
            {drafts.map((d, i) => (
              <ListRow
                key={d.report_id}
                first={i === 0}
                icon={d.is_revision ? 'git-branch-outline' : 'document-text-outline'}
                label={d.title}
                sublabel={[
                  formatDate(d.meeting_date),
                  t('mob.mmPagesN', { n: d.page_count }),
                  d.audio_ms ? t('mob.mmRecordingN', { d: formatDuration(d.audio_ms) }) : null,
                  d.is_revision ? t('mob.mmUpdateDraft') : null
                ].filter(Boolean).join(' · ')}
                onPress={() => router.push(`/meeting-records/draft/${d.report_id}`)}
              />
            ))}
          </View>
        </>
      ) : null}

      {open_comments > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Callout icon="chatbubbles-outline" tone="warning" text={t('mob.mmCommentsToAnswer', { n: open_comments })} />
        </View>
      ) : null}

      {published.length > 0 ? (
        <>
          <GroupLabel>{t('mob.mmPublished')}</GroupLabel>
          {published.map((row) => (
            <View key={row.id}>
              <MinutesRowCard row={row} onPress={() => router.push(`/meeting-records/${row.id}`)} />
              <View style={{ marginTop: -spacing.xs, marginBottom: spacing.md }}>
                <Button label={t('mob.mmUpdateMinutes')} variant="secondary" icon="create-outline" loading={busy === row.id} onPress={() => void update(row.id)} />
              </View>
            </View>
          ))}
        </>
      ) : null}
      <View style={{ height: spacing.xl }} />
    </Screen>
  )
}
