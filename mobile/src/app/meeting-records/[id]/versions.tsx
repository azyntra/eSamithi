import React from 'react'
import { View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../../i18n'
import { spacing, usePalette } from '../../../theme'
import { formatDate } from '../../../lib/date'
import { useMinutesReport } from '../../../api/minutes'
import { ErrorView, Screen, SkeletonCards, useCardStyle } from '../../../ui'
import { ScalePressable } from '../../../ui/pressable'
import { MText, Pill } from '../../../ui/minutes'

// Version history (§8.1.3): every published version, newest first, each
// exactly as it was published
export default function MinutesVersions(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>()
  const reportId = Number(id)
  const { t } = useT()
  const p = usePalette()
  const card = useCardStyle()
  const router = useRouter()
  const report = useMinutesReport(reportId)

  if (report.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (report.isError || !report.data) return <Screen><ErrorView onRetry={() => void report.refetch()} /></Screen>
  const { versions, report: info } = report.data

  return (
    <Screen>
      <MText color={p.textMuted} style={{ marginBottom: spacing.md }}>{t('mob.mmVersionsIntro')}</MText>
      {versions.filter((x) => x.state === 'published').map((x) => {
        const isLatest = x.version_no === info.latest_version_no
        return (
          <ScalePressable
            key={x.version_no ?? 0}
            accessibilityRole="button"
            onPress={() => router.push(isLatest ? `/meeting-records/${reportId}` : `/meeting-records/${reportId}?v=${x.version_no}`)}
            scaleTo={0.99}
            style={[card, { padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.xs, borderWidth: isLatest ? 2 : 1, borderColor: isLatest ? p.primary : p.border }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MText size="heading" weight="bold" style={{ flex: 1 }}>{t('mob.mmVersionLong', { n: x.version_no ?? '—' })}</MText>
              {isLatest ? <Pill tone="brand" text={t('mob.mmLatest')} /> : null}
              <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
            </View>
            <MText size="caption" color={p.textMuted}>
              {formatDate(String(x.published_at ?? '').slice(0, 10))} · {x.author_name ?? ''}{x.author_position === 'office' ? ` (${t('mob.mmOffice')})` : ` (${t('mob.mmSecretary')})`}
            </MText>
            <MText size="caption">{x.change_summary ?? t('mob.mmFirstPublication')}</MText>
          </ScalePressable>
        )
      })}
    </Screen>
  )
}
