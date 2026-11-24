import React from 'react'
import { Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing, type as typeScale, usePalette } from '../theme'
import { interFamily, useType } from '../typography'
import { useT } from '../i18n'
import { formatDate } from '../lib/date'
import type { Announcement } from '../api/hooks'
import { ScalePressable } from './pressable'
import { DateBlock, useCardStyle } from './v2'

// One notice, three treatments (redesign §3.9, §6.4). A death notice is calm
// slate with the deceased's name first — never the alarm red of an overdue
// loan. Meetings lead with their date; general notices with their title.

export function NoticeCard({ notice, compact, onPress }: { notice: Announcement; compact?: boolean; onPress?: () => void }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  const { t } = useT()
  const card = useCardStyle()
  const n = notice
  const bodyLines = compact ? 2 : 3

  const overline = (color: string, label: string, icon: keyof typeof Ionicons.glyphMap, chipBg: string): React.ReactElement => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: chipBg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ flex: 1, color, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro) }}>{label}</Text>
      <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: interFamily.regular }}>{formatDate(n.created_at)}</Text>
    </View>
  )

  let content: React.ReactElement
  if (n.type === 'death') {
    content = (
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: p.memorial }} />
        <View style={{ flex: 1, padding: spacing.lg, paddingLeft: spacing.md + 2 }}>
          {overline(p.memorial, t('mob.noticeDeath'), 'flower-outline', p.memorialBg)}
          <Text style={{ color: p.text, fontSize: compact ? typeScale.heading : typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(compact ? typeScale.heading : typeScale.title), marginTop: spacing.sm }}>
            {n.deceased_name || n.title}
          </Text>
          {n.deceased_name && n.title !== n.deceased_name ? (
            <Text numberOfLines={2} style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{n.title}</Text>
          ) : null}
          {n.funeral_date || n.funeral_location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, backgroundColor: p.memorialBg, borderRadius: radius.sm + 2, padding: spacing.sm + 2 }}>
              {n.funeral_date ? <DateBlock date={n.funeral_date} /> : <Ionicons name="location-outline" size={22} color={p.memorial} />}
              <Text style={{ flex: 1, color: p.text, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>
                {n.funeral_location || `${t('mob.funeralDate')}: ${formatDate(n.funeral_date)}`}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    )
  } else if (n.type === 'meeting') {
    content = (
      <View style={{ flexDirection: 'row', gap: spacing.md + 2, padding: spacing.lg }}>
        {n.event_date ? <DateBlock date={n.event_date} tone="brand" large /> : null}
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.primaryOnSoft, fontSize: typeScale.micro, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.noticeMeeting')}</Text>
          <Text style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading) }}>{n.title}</Text>
          {n.body ? (
            <Text numberOfLines={bodyLines} style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{n.body}</Text>
          ) : null}
        </View>
      </View>
    )
  } else if (n.type === 'minutes') {
    content = (
      <View style={{ padding: spacing.lg }}>
        {overline(p.primaryOnSoft, t('mob.noticeMinutes'), 'book-outline', p.primarySoft)}
        <Text style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading), marginTop: spacing.sm }}>{n.title}</Text>
        <Text style={{ color: p.primary, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.xs }}>{t('mob.mmReadAndListen')}</Text>
      </View>
    )
  } else {
    content = (
      <View style={{ padding: spacing.lg }}>
        {overline(p.primary, t('mob.noticeGeneral'), 'megaphone-outline', p.surfaceAlt)}
        <Text style={{ color: p.text, fontSize: typeScale.heading, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.heading), marginTop: spacing.sm }}>{n.title}</Text>
        {n.body ? (
          <Text numberOfLines={bodyLines} style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption) }}>{n.body}</Text>
        ) : null}
      </View>
    )
  }

  // The memorial rule must stay inside the rounded corners
  const clip = n.type === 'death' ? { overflow: 'hidden' as const } : null
  if (!onPress) return <View style={[card, { marginBottom: spacing.md }, clip]}>{content}</View>
  return (
    <ScalePressable accessibilityRole="button" onPress={onPress} scaleTo={0.98} style={[card, { marginBottom: spacing.md }, clip]}>
      {content}
    </ScalePressable>
  )
}
