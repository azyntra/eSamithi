import React, { useEffect } from 'react'
import { Share, Text, View } from 'react-native'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useT } from '../../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../../theme'
import { useType } from '../../typography'
import { useAnnouncements } from '../../api/hooks'
import { formatDate } from '../../lib/date'
import { DateBlock, ErrorView, ScalePressable, Screen, SkeletonCards, StaleBanner, useCardStyle, useToast } from '../../ui'

// One notice in full (redesign §6.4.1) — where a notice push now lands.
// Death notices use the memorial treatment: slate, the name first, no red.

export default function NoticeDetail(): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const navigation = useNavigation()
  const toast = useToast()
  const card = useCardStyle()
  const { id } = useLocalSearchParams<{ id: string }>()
  const notices = useAnnouncements()
  const notice = notices.data?.find((n) => n.id === Number(id))

  // A push for a notice that has since expired or been hidden: say so and
  // show the list instead of an empty screen.
  useEffect(() => {
    if (notices.data && !notice) {
      toast.show('info', t('mob.noticeGone'))
      router.replace('/(tabs)/notices')
    }
  }, [notices.data, notice, router, t, toast])

  useEffect(() => {
    if (notice) navigation.setOptions({ title: notice.type === 'death' ? t('mob.noticeDeath') : t('mob.noticeTitle') })
  }, [navigation, notice, t])

  if (notices.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (notices.isError && !notices.data) {
    return (
      <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
        <ErrorView onRetry={() => notices.refetch()} />
      </Screen>
    )
  }
  if (!notice) return <Screen><SkeletonCards cards={1} /></Screen>

  const n = notice
  const death = n.type === 'death'
  const meeting = n.type === 'meeting'
  const accent = death ? p.memorial : p.primaryOnSoft
  const tint = death ? p.memorialBg : p.primarySoft
  const icon: keyof typeof Ionicons.glyphMap = death ? 'flower-outline' : meeting ? 'calendar-outline' : 'megaphone-outline'
  const kind = death ? t('mob.noticeDeath') : meeting ? t('mob.noticeMeeting') : t('mob.noticeGeneral')
  const heading = death ? (n.deceased_name || n.title) : n.title
  const when = death ? n.funeral_date : meeting ? n.event_date : null

  const share = (): void => {
    const lines = [kind, heading, death && n.deceased_name && n.title !== n.deceased_name ? n.title : null,
      n.funeral_date ? `${t('mob.funeralDate')}: ${formatDate(n.funeral_date)}` : null,
      n.funeral_location ? `${t('mob.funeralLocation')}: ${n.funeral_location}` : null,
      n.event_date ? `${t('mob.meetingDate')}: ${formatDate(n.event_date)}` : null,
      n.body].filter(Boolean)
    Share.share({ message: lines.join('\n') }).catch(() => {})
  }

  return (
    <Screen refreshing={notices.isRefetching} onRefresh={() => notices.refetch()}>
      {notices.isError && <StaleBanner />}
      <View style={{ alignItems: 'center', backgroundColor: tint, borderRadius: radius.lg, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icon} size={32} color={accent} />
        </View>
        <Text style={{ color: accent, fontSize: typeScale.caption, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.caption), marginTop: spacing.md }}>{kind}</Text>
        <Text accessibilityRole="header" style={{ color: p.text, fontSize: typeScale.title, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.title), textAlign: 'center' }}>{heading}</Text>
        {death && n.deceased_name && n.title !== n.deceased_name ? (
          <Text style={{ color: p.textMuted, fontSize: typeScale.caption, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.caption), textAlign: 'center' }}>{n.title}</Text>
        ) : null}
      </View>

      {when || n.funeral_location ? (
        <View style={[card, { padding: spacing.lg, marginTop: spacing.md }]}>
          {when ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2 }}>
              <DateBlock date={when} tone={death ? 'memorial' : 'brand'} large />
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{death ? t('mob.funeralDate') : t('mob.meetingDate')}</Text>
                <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{formatDate(when)}</Text>
              </View>
            </View>
          ) : null}
          {n.funeral_location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2, marginTop: when ? spacing.md : 0, paddingTop: when ? spacing.md : 0, borderTopWidth: when ? 1 : 0, borderTopColor: p.border }}>
              <View style={{ width: 52, alignItems: 'center' }}>
                <Ionicons name="location-outline" size={24} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro) }}>{t('mob.funeralLocation')}</Text>
                <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.bold, lineHeight: ty.lh(typeScale.body) }}>{n.funeral_location}</Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {n.body ? (
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.body) + 4, marginTop: spacing.lg, paddingHorizontal: spacing.xs }}>{n.body}</Text>
      ) : null}
      <Text style={{ color: p.textMuted, fontSize: typeScale.micro, fontFamily: ty.family.regular, lineHeight: ty.lh(typeScale.micro), marginTop: spacing.md, paddingHorizontal: spacing.xs }}>
        {`${formatDate(n.created_at)} · ${t('mob.noticeFrom')}`}
      </Text>

      <ScalePressable
        accessibilityRole="button"
        onPress={share}
        style={{ marginTop: spacing.lg, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: p.borderStrong, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}
      >
        <Ionicons name="share-social-outline" size={18} color={p.text} />
        <Text style={{ color: p.text, fontSize: typeScale.body, fontFamily: ty.family.semibold, lineHeight: ty.lh(typeScale.body) }}>{t('mob.share')}</Text>
      </ScalePressable>
    </Screen>
  )
}
