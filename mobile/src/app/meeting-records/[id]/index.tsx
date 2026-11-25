import React, { useEffect, useRef, useState } from 'react'
import { FlatList, Linking, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import Constants from 'expo-constants'
import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../../../i18n'
import { radius, spacing, usePalette } from '../../../theme'
import { formatDate } from '../../../lib/date'
import { hasAudioPlayback } from '../../../lib/audioSupport'
import { absolute, errorCode, formatDuration, minutesApi, putDraft, useMinutesComments, useMinutesReport } from '../../../api/minutes'
import { BottomSheet, Button, Callout, ErrorView, Screen, SkeletonCards, useCardStyle, useToast } from '../../../ui'
import { ScalePressable } from '../../../ui/pressable'
import { PhotoViewer } from '../../../ui/PhotoViewer'
import { MinutesPlayer } from '../../../ui/MinutesPlayer'
import { MText, Pill } from '../../../ui/minutes'

export { ErrorBoundary } from '../../../ui/ErrorScreen'

// The report reader (§8.1.2): the pages one by one (swipe, or the arrows),
// full-screen zoom on tap, the PDF to save or share, versions and comments.
// Listening arrives with the 1.7.0 app; until then the recording shows how to
// get it.
export default function MinutesReader(): React.ReactElement {
  const params = useLocalSearchParams<{ id: string; v?: string; page?: string; t?: string }>()
  const id = Number(params.id)
  const versionNo = params.v ? Number(params.v) : undefined
  const { t } = useT()
  const p = usePalette()
  const card = useCardStyle()
  const router = useRouter()
  const navigation = useNavigation()
  const toast = useToast()
  const qc = useQueryClient()
  const { width } = useWindowDimensions()
  const report = useMinutesReport(id, versionNo)
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [grid, setGrid] = useState(false)
  const [busy, setBusy] = useState(false)
  const pager = useRef<FlatList>(null)

  const v = report.data?.version
  useEffect(() => {
    if (v) navigation.setOptions({ title: v.title })
  }, [v, navigation])

  // A page mentioned in a comment opens here at that page
  useEffect(() => {
    const n = params.page ? Number(params.page) : 0
    if (v && n >= 1 && n <= v.pages.length) {
      setIndex(n - 1)
      setTimeout(() => pager.current?.scrollToIndex({ index: n - 1, animated: false }), 0)
    }
  }, [params.page, v])

  if (report.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (report.isError || !report.data || !v) {
    const code = errorCode(report.error)
    if (code === 'VERSION_WITHDRAWN' || code === 'NOT_FOUND') {
      return (
        <Screen>
          <Callout icon="alert-circle-outline" tone="warning" text={code === 'VERSION_WITHDRAWN' ? t('mob.mmWithdrawn') : t('mob.mmNotFound')} />
          <Button label={t('mob.mmBackToList')} variant="secondary" onPress={() => router.replace('/meeting-records')} />
        </Screen>
      )
    }
    return <Screen><ErrorView onRetry={() => void report.refetch()} /></Screen>
  }

  const { report: info, versions, can } = report.data
  const pageWidth = width - spacing.lg * 2
  const urls = v.pages.map((pg) => absolute(pg.url) ?? '')
  const latest = info.latest_version_no
  const olderVersion = v.version_no !== null && latest !== null && v.version_no < latest
  const go = (i: number): void => {
    const next = Math.max(0, Math.min(v.pages.length - 1, i))
    setIndex(next)
    pager.current?.scrollToIndex({ index: next, animated: true })
  }

  const openPdf = async (): Promise<void> => {
    const url = absolute(v.pdf_url)
    if (!url) return
    try {
      await WebBrowser.openBrowserAsync(url)
    } catch {
      Linking.openURL(url).catch(() => toast.show('error', t('mob.errorLoad')))
    }
  }

  const update = async (): Promise<void> => {
    setBusy(true)
    try {
      if (!info.has_draft) putDraft(qc, await minutesApi.startRevision(id))
      router.push(`/meeting-records/draft/${id}`)
    } catch {
      toast.show('error', t('mob.errorLoad'))
    } finally {
      setBusy(false)
    }
  }

  const storeUrl = `market://details?id=${Constants.expoConfig?.android?.package ?? 'lk.esamithi.member'}`

  return (
    <Screen refreshing={report.isRefetching} onRefresh={() => void report.refetch()} padded={false}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 2 }}>
        <MText size="title" weight="bold">{t('mob.mmMeetingOn', { date: formatDate(v.meeting_date) })}</MText>
        <MText size="caption" color={p.textMuted}>
          {t('mob.mmVersion', { n: v.version_no ?? '—' })} · {t('mob.mmPublishedOn', { date: formatDate(String(v.published_at ?? '').slice(0, 10)) })}
        </MText>
        <MText size="caption" color={p.textMuted}>
          {v.author_position === 'office' ? t('mob.mmByOffice', { name: v.author_name ?? '' }) : t('mob.mmBySecretary', { name: v.author_name ?? '' })}
        </MText>
      </View>

      {olderVersion ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Callout icon="time-outline" tone="warning" text={t('mob.mmOlderVersion', { n: v.version_no ?? '' })}>
            <Button label={t('mob.mmOpenLatest')} variant="secondary" onPress={() => router.setParams({ v: undefined })} />
          </Callout>
        </View>
      ) : null}
      {v.change_summary ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Callout icon="create-outline" tone="brand" text={t('mob.mmWhatChanged', { text: v.change_summary })} />
        </View>
      ) : null}

      <FlatList
        ref={pager}
        data={v.pages}
        horizontal
        pagingEnabled
        snapToInterval={pageWidth + spacing.lg}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        keyExtractor={(pg) => String(pg.id)}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.md }}
        getItemLayout={(_, i) => ({ length: pageWidth + spacing.lg, offset: (pageWidth + spacing.lg) * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (pageWidth + spacing.lg)))}
        renderItem={({ item, index: i }) => (
          <ScalePressable
            accessibilityRole="imagebutton"
            accessibilityLabel={t('mob.mmPageOf', { n: i + 1, total: v.pages.length })}
            accessibilityHint={t('mob.mmTapToZoom')}
            onPress={() => setZoom(true)}
            scaleTo={0.99}
            style={{ width: pageWidth, height: Math.min(pageWidth * (item.height / item.width), 560), borderRadius: radius.sm, overflow: 'hidden', backgroundColor: p.surface, borderWidth: 1, borderColor: p.border }}
          >
            <Image source={{ uri: absolute(item.url) ?? undefined }} placeholder={{ uri: absolute(item.thumb_url) ?? undefined }} style={{ flex: 1 }} contentFit="contain" />
          </ScalePressable>
        )}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <PagerButton icon="chevron-back" label={t('mob.mmPrevPage')} disabled={index === 0} onPress={() => go(index - 1)} />
        <MText weight="semibold" accessibilityLiveRegion="polite">{t('mob.mmPageOf', { n: index + 1, total: v.pages.length })}</MText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <PagerButton icon="grid-outline" label={t('mob.mmAllPages')} onPress={() => setGrid(true)} />
          <PagerButton icon="chevron-forward" label={t('mob.mmNextPage')} disabled={index >= v.pages.length - 1} onPress={() => go(index + 1)} />
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
        {v.audio_url ? (
          hasAudioPlayback() ? (
            <MinutesPlayer
              key={`${id}-${v.version_no}`}
              url={absolute(v.audio_url) ?? ''}
              durationMs={v.audio_ms}
              seekToMs={params.t ? Number(params.t) : null}
              onSeekHandled={() => router.setParams({ t: undefined })}
            />
          ) : (
            <Callout icon="headset-outline" tone="warning" text={t('mob.mmListenUpdate', { d: formatDuration(v.audio_ms) })}>
              <Button label={t('mob.mmUpdateApp')} variant="secondary" icon="download-outline" onPress={() => { Linking.openURL(storeUrl).catch(() => {}) }} />
            </Callout>
          )
        ) : null}

        {v.pdf_url ? <Button label={t('mob.mmSharePdf')} icon="document-outline" variant="secondary" onPress={() => void openPdf()} /> : null}

        <View style={[card, { paddingVertical: 0 }]}>
          <NavRow icon="chatbubbles-outline" label={t('mob.mmComments')} right={<CommentsPill reportId={id} />} onPress={() => router.push(`/meeting-records/${id}/comments`)} first />
          <NavRow icon="git-branch-outline" label={t('mob.mmVersions', { n: versions.filter((x) => x.state === 'published').length })} onPress={() => router.push(`/meeting-records/${id}/versions`)} />
        </View>

        {can.publish && !olderVersion ? (
          <Button label={info.has_draft ? t('mob.mmContinueUpdate') : t('mob.mmUpdateMinutes')} icon="create-outline" loading={busy} onPress={() => void update()} />
        ) : null}
        <View style={{ height: spacing.xl }} />
      </View>

      <PhotoViewer photos={urls} initialIndex={index} visible={zoom} onClose={() => setZoom(false)} />
      <BottomSheet visible={grid} onClose={() => setGrid(false)} title={t('mob.mmAllPages')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {v.pages.map((pg, i) => (
            <ScalePressable
              key={pg.id}
              accessibilityRole="button"
              accessibilityLabel={t('mob.mmPageOf', { n: i + 1, total: v.pages.length })}
              onPress={() => { setGrid(false); go(i) }}
              style={{ width: 92, height: 120, borderRadius: radius.sm, overflow: 'hidden', borderWidth: i === index ? 2 : 1, borderColor: i === index ? p.primary : p.border, backgroundColor: p.surface }}
            >
              <Image source={{ uri: absolute(pg.thumb_url) ?? undefined }} style={{ flex: 1 }} contentFit="contain" />
              <View style={{ position: 'absolute', left: spacing.xs, top: spacing.xs }}>
                <Pill tone="brand" text={String(i + 1)} />
              </View>
            </ScalePressable>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  )
}

function PagerButton({ icon, label, onPress, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean }): React.ReactElement {
  const p = usePalette()
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Ionicons name={icon} size={22} color={p.text} />
    </ScalePressable>
  )
}

function NavRow({ icon, label, right, onPress, first }: { icon: keyof typeof Ionicons.glyphMap; label: string; right?: React.ReactNode; onPress: () => void; first?: boolean }): React.ReactElement {
  const p = usePalette()
  return (
    <ScalePressable
      accessibilityRole="button"
      onPress={onPress}
      scaleTo={0.99}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.lg, borderTopWidth: first ? 0 : 1, borderTopColor: p.border }}
    >
      <Ionicons name={icon} size={22} color={p.primary} />
      <View style={{ flex: 1 }}>
        <MText weight="semibold">{label}</MText>
      </View>
      {right}
      <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
    </ScalePressable>
  )
}

function CommentsPill({ reportId }: { reportId: number }): React.ReactElement | null {
  const { t } = useT()
  const comments = useMinutesComments(reportId)
  const items = comments.data ?? []
  const open = items.filter((c) => c.parent_id === null && c.status === 'open' && !c.hidden && !c.deleted).length
  const total = items.filter((c) => c.parent_id === null && !c.deleted).length
  if (total === 0) return null
  return <Pill tone={open > 0 ? 'warning' : 'neutral'} text={open > 0 ? t('mob.mmOpenOfTotal', { open, total }) : String(total)} />
}
