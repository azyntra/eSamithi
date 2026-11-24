import React from 'react'
import { Text, View, type TextProps, type TextStyle } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { useType } from '../typography'
import { useT } from '../i18n'
import { formatDate } from '../lib/date'
import type { MinutesRow } from '../api/minutes'
import { formatDuration } from '../api/minutes'
import { ScalePressable } from './pressable'
import { DateBlock, useCardStyle } from './v2'

// Shared pieces for the meeting minutes screens
// (docs/MEETING-MINUTES-REQUIREMENTS.md §8.1–§8.2).

type Size = keyof typeof typeScale
type Weight = 'regular' | 'semibold' | 'bold'

// Text on the scale, in the language's family, with Sinhala-safe leading
export function MText({ size = 'body', weight = 'regular', color, style, children, ...rest }: TextProps & { size?: Size; weight?: Weight; color?: string; style?: TextStyle }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <Text {...rest} style={[{ color: color ?? p.text, fontSize: typeScale[size], fontFamily: ty.family[weight], lineHeight: ty.lh(typeScale[size]) }, style]}>
      {children}
    </Text>
  )
}

export function Pill({ text, tone }: { text: string; tone: 'brand' | 'success' | 'warning' | 'neutral' | 'danger' }): React.ReactElement {
  const p = usePalette()
  const colors = {
    brand: { bg: p.primarySoft, fg: p.primaryOnSoft },
    success: { bg: p.successBg, fg: p.success },
    warning: { bg: p.warningBg, fg: p.warning },
    danger: { bg: p.dangerBg, fg: p.danger },
    neutral: { bg: p.surfaceAlt, fg: p.textMuted }
  }[tone]
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm + 2, paddingVertical: 2 }}>
      <MText size="micro" weight="semibold" color={colors.fg}>{text}</MText>
    </View>
  )
}

// One report in a list: meeting date, title, version, publication date
export function MinutesRowCard({ row, onPress }: { row: MinutesRow; onPress: () => void }): React.ReactElement {
  const p = usePalette()
  const card = useCardStyle()
  const { t } = useT()
  const meta = [
    row.version_no ? t('mob.mmVersion', { n: row.version_no }) : null,
    row.published_at ? t('mob.mmPublishedOn', { date: formatDate(String(row.published_at).slice(0, 10)) }) : null
  ].filter(Boolean).join(' · ')
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${formatDate(row.meeting_date)}, ${meta}`}
      onPress={onPress}
      scaleTo={0.99}
      style={[card, { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md + 2, marginBottom: spacing.sm }]}
    >
      <DateBlock date={row.meeting_date} tone="brand" large />
      <View style={{ flex: 1, gap: 2 }}>
        <MText weight="semibold">{row.title}</MText>
        <MText size="caption" color={p.textMuted}>{meta}</MText>
        {row.open_comment_count > 0 ? <Pill tone="warning" text={t('mob.mmOpenCorrections', { n: row.open_comment_count })} /> : null}
      </View>
      {row.has_audio ? (
        <View accessibilityLabel={t('mob.mmHasRecording', { d: formatDuration(row.audio_ms) })} style={{ alignItems: 'center' }}>
          <Ionicons name="headset-outline" size={22} color={p.primary} />
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </ScalePressable>
  )
}
