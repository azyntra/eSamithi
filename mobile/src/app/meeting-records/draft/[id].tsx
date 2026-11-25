import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Linking, Switch, View } from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as SecureStore from 'expo-secure-store'
import * as WebBrowser from 'expo-web-browser'
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../../../i18n'
import { radius, spacing, usePalette } from '../../../theme'
import { useAuth } from '../../../auth/AuthContext'
import { uuid4 } from '../../../lib/attendance'
import { formatDate } from '../../../lib/date'
import { errorMessage } from '../../../api/client'
import { absolute, errorCode, formatDuration, minutesApi, minutesKeys, putDraft, useMinutesDraft, type MinutesDraft } from '../../../api/minutes'
import { BottomSheet, Button, Callout, ErrorView, Input, ListRow, Screen, SegmentedTabs, SkeletonCards, useCardStyle, useToast } from '../../../ui'
import { DateField } from '../../../ui/auth'
import { ScalePressable } from '../../../ui/pressable'
import { PhotoViewer } from '../../../ui/PhotoViewer'
import { MinutesRecorder } from '../../../ui/MinutesRecorder'
import { hasAudioPlayback } from '../../../lib/audioSupport'
import { MText, Pill } from '../../../ui/minutes'
import { NewMinutesForm } from '../../../ui/NewMinutesForm'

type Step = 'details' | 'pages' | 'recording' | 'publish'

interface Pending {
  key: string
  uri: string
  clientRef: string
  replacePageId?: number
  status: 'waiting' | 'uploading' | 'failed'
}

// Handwriting stays readable at 2000 px on the long side, JPEG 0.8 (§6.3)
async function preparePage(asset: { uri: string; width?: number; height?: number }): Promise<string> {
  const w = asset.width ?? 0
  const h = asset.height ?? 0
  let ctx = ImageManipulator.manipulate(asset.uri)
  if (Math.max(w, h) > 2000) ctx = w >= h ? ctx.resize({ width: 2000 }) : ctx.resize({ height: 2000 })
  const rendered = await ctx.renderAsync()
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })
  return saved.uri
}

// Pages waiting to upload survive the app closing: kept per society and draft
const queueKey = (slug: string | undefined, reportId: number): string => `esamithi.mm.queue.${slug ?? 'default'}.${reportId}`

// A render error shows a way back instead of an empty screen, and is reported
export { ErrorBoundary } from '../../../ui/ErrorScreen'

// /meeting-records/draft/new is the new-minutes form; creating the draft
// turns this same screen into its editor. No navigation happens at that
// moment (a replace there left Android with a blank window, 25 Nov 2026).
export default function MinutesDraftRoute(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useT()
  const navigation = useNavigation()
  const isNew = id === 'new'
  // Set directly: a <Stack.Screen> title is not re-applied after setParams
  useLayoutEffect(() => {
    navigation.setOptions({ title: isNew ? t('mob.mmNewMinutes') : t('mob.mmDraftTitle') })
  }, [navigation, isNew, t])
  return isNew
    ? <NewMinutesForm onCreated={(draft) => router.setParams({ id: String(draft.report_id) })} />
    : <MinutesDraftEditor key={id} reportId={Number(id)} />
}

// The Secretary's draft (§8.2.2–§8.2.5): details, pages, recording, publish.
function MinutesDraftEditor({ reportId }: { reportId: number }): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const card = useCardStyle()
  const router = useRouter()
  const toast = useToast()
  const qc = useQueryClient()
  const { activeProfile } = useAuth()
  const draft = useMinutesDraft(reportId)
  const d = draft.data

  const [step, setStep] = useState<Step>('pages')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [queue, setQueue] = useState<Pending[]>([])
  const [loadedQueue, setLoadedQueue] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [zoom, setZoom] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [notify, setNotify] = useState(false)
  const [published, setPublished] = useState<{ version_no: number; notified: boolean } | null>(null)
  const running = useRef(false)
  const publishRef = useRef(uuid4())

  useEffect(() => {
    if (d) {
      setTitle(d.title)
      setSummary(d.change_summary ?? '')
      if (d.page_count === 0 && d.title) setStep('pages')
    }
    // Load once per draft; typing is not overwritten by a refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.report_id])

  const apply = useCallback((next: MinutesDraft) => putDraft(qc, next), [qc])

  // No longer the Secretary (reassigned while this was open): say so and leave
  const handleError = useCallback((err: unknown, fallback: string): void => {
    if (errorCode(err) === 'NOT_SECRETARY') {
      toast.show('info', t('mob.mmNotSecretary'))
      void qc.invalidateQueries({ queryKey: ['me', 'profile'] })
      router.dismissTo('/(tabs)/me')
      return
    }
    toast.show('error', errorMessage(err, fallback))
  }, [qc, router, t, toast])

  // Restore pages that were waiting when the app last closed
  useEffect(() => {
    let live = true
    SecureStore.getItemAsync(queueKey(activeProfile?.slug, reportId))
      .then((raw) => {
        if (!live) return
        const saved = raw ? (JSON.parse(raw) as Array<Omit<Pending, 'status' | 'key'>>) : []
        if (saved.length) setQueue(saved.map((s) => ({ ...s, key: s.clientRef, status: 'waiting' })))
        setLoadedQueue(true)
      })
      .catch(() => setLoadedQueue(true))
    return () => { live = false }
  }, [activeProfile?.slug, reportId])

  useEffect(() => {
    if (!loadedQueue) return
    const keep = queue.map(({ uri, clientRef, replacePageId }) => ({ uri, clientRef, replacePageId }))
    const key = queueKey(activeProfile?.slug, reportId)
    ;(keep.length ? SecureStore.setItemAsync(key, JSON.stringify(keep)) : SecureStore.deleteItemAsync(key)).catch(() => {})
  }, [queue, loadedQueue, activeProfile?.slug, reportId])

  // One page at a time, in order; a failed page waits for Retry and never
  // holds up the others. A page already on the server is not sent twice.
  useEffect(() => {
    if (running.current || !loadedQueue) return
    const next = queue.find((q) => q.status === 'waiting')
    if (!next) return
    running.current = true
    setQueue((qs) => qs.map((q) => (q.key === next.key ? { ...q, status: 'uploading' } : q)))
    void (async () => {
      try {
        apply(await minutesApi.addPage(reportId, { uri: next.uri, clientRef: next.clientRef, replacePageId: next.replacePageId }))
        setQueue((qs) => qs.filter((q) => q.key !== next.key))
      } catch (err) {
        if (errorCode(err) === 'NOT_SECRETARY') handleError(err, '')
        setQueue((qs) => qs.map((q) => (q.key === next.key ? { ...q, status: 'failed' } : q)))
      } finally {
        running.current = false
        setQueue((qs) => [...qs])
      }
    })()
  }, [queue, loadedQueue, reportId, apply, handleError])

  const enqueue = (uris: string[], replacePageId?: number): void => {
    setQueue((qs) => [...qs, ...uris.map((uri) => ({ key: uuid4(), uri, clientRef: uuid4(), replacePageId, status: 'waiting' as const }))])
  }

  const askSettings = (title2: string, body: string): void => {
    Alert.alert(title2, body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mob.mmOpenSettings'), onPress: () => { Linking.openSettings().catch(() => {}) } }
    ])
  }

  // Camera: one page at a time, straight back to the camera for the next
  const takePhoto = async (replacePageId?: number): Promise<void> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return askSettings(t('mob.mmCameraOff'), t('mob.mmCameraOffBody'))
    const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
    if (shot.canceled || !shot.assets[0]) return
    enqueue([await preparePage(shot.assets[0])], replacePageId)
    if (replacePageId) return
    Alert.alert(t('mob.mmPageAdded'), t('mob.mmNextPageQ'), [
      { text: t('mob.mmDone'), style: 'cancel' },
      { text: t('mob.mmNextPagePhoto'), onPress: () => void takePhoto() }
    ])
  }

  const pickPhotos = async (replacePageId?: number): Promise<void> => {
    const remaining = Math.max(1, (d?.max_pages ?? 40) - (d?.page_count ?? 0) - queue.length)
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: !replacePageId,
      selectionLimit: replacePageId ? 1 : remaining,
      orderedSelection: true,
      quality: 1
    })
    if (res.canceled) return
    const uris: string[] = []
    for (const a of res.assets) uris.push(await preparePage(a))
    enqueue(uris, replacePageId)
  }

  const act = async (label: string, fn: () => Promise<MinutesDraft | void>): Promise<void> => {
    setBusy(label)
    try {
      const next = await fn()
      if (next) apply(next)
    } catch (err) {
      handleError(err, t('mob.errorLoad'))
    } finally {
      setBusy(null)
    }
  }

  if (draft.isPending) return <Screen><SkeletonCards cards={3} /></Screen>
  if (draft.isError || !d) {
    if (errorCode(draft.error) === 'NOT_SECRETARY') {
      return <Screen><Callout icon="lock-closed-outline" tone="warning" text={t('mob.mmNotSecretary')} /></Screen>
    }
    if (errorCode(draft.error) === 'NO_DRAFT') {
      return (
        <Screen>
          <Callout icon="checkmark-circle-outline" tone="brand" text={t('mob.mmNoDraft')} />
          <Button label={t('mob.mmOpenReport')} variant="secondary" onPress={() => router.replace(`/meeting-records/${reportId}`)} />
        </Screen>
      )
    }
    return <Screen><ErrorView onRetry={() => void draft.refetch()} /></Screen>
  }

  if (published) {
    return (
      <Screen>
        <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: p.successBg, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={44} color={p.success} />
          </View>
          <MText size="title" weight="bold" accessibilityLiveRegion="polite" style={{ textAlign: 'center' }}>{t('mob.mmPublishedTitle', { n: published.version_no })}</MText>
          <MText color={p.textMuted} style={{ textAlign: 'center' }}>{published.notified ? t('mob.mmPublishedNotified') : t('mob.mmPublishedQuiet')}</MText>
        </View>
        <Button label={t('mob.mmOpenReport')} onPress={() => router.replace(`/meeting-records/${reportId}`)} />
        <View style={{ height: spacing.sm }} />
        <Button label={t('mob.mmBackToList')} variant="secondary" onPress={() => router.dismissTo('/meeting-records')} />
      </Screen>
    )
  }

  const uploading = queue.some((q) => q.status !== 'failed')
  const failed = queue.filter((q) => q.status === 'failed').length
  const audioPending = d.audio_uploads.length > 0
  const ready = d.page_count > 0 && !uploading && !audioPending && title.trim() !== '' && (!d.is_revision || summary.trim() !== '')
  const page = selected !== null ? d.pages.find((x) => x.id === selected) ?? null : null
  const pageIndex = page ? d.pages.indexOf(page) : -1

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= d.pages.length) return
    const ids = d.pages.map((x) => x.id)
    const [m] = ids.splice(from, 1)
    ids.splice(to, 0, m)
    void act('order', () => minutesApi.reorder(reportId, ids))
  }

  const previewPdf = async (): Promise<void> => {
    setBusy('pdf')
    try {
      const r = await minutesApi.previewPdf(reportId)
      void draft.refetch()
      const url = absolute(r.pdf_url)
      if (url) await WebBrowser.openBrowserAsync(url)
    } catch (err) {
      handleError(err, t('mob.mmPdfFailed'))
    } finally {
      setBusy(null)
    }
  }

  const publish = async (): Promise<void> => {
    setBusy('publish')
    try {
      if (d.is_revision && summary.trim() !== (d.change_summary ?? '')) await minutesApi.updateDraft(reportId, { change_summary: summary.trim() })
      const r = await minutesApi.publish(reportId, { publish_ref: publishRef.current, change_summary: d.is_revision ? summary.trim() : undefined, notify: d.is_revision ? notify : undefined })
      void qc.invalidateQueries({ queryKey: minutesKeys.all })
      setPublished({ version_no: r.version_no, notified: r.notified })
    } catch (err) {
      // Same publish_ref on every retry: it can never publish twice
      handleError(err, t('mob.mmPublishRetry'))
    } finally {
      setBusy(null)
    }
  }

  const confirmPublish = (): void => {
    const body = d.is_revision ? (notify ? t('mob.mmConfirmRevisionNotify') : t('mob.mmConfirmRevisionQuiet')) : t('mob.mmConfirmFirst')
    Alert.alert(d.is_revision ? t('mob.mmPublishVersion', { n: d.next_version_no }) : t('mob.mmPublishQ'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mob.mmPublish'), onPress: () => void publish() }
    ])
  }

  const discard = (): void => {
    Alert.alert(t('mob.mmDiscardQ'), d.is_revision ? t('mob.mmDiscardRevisionBody') : t('mob.mmDiscardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mob.mmDiscard'),
        style: 'destructive',
        onPress: () => void act('discard', async () => {
          await minutesApi.discard(reportId)
          setQueue([])
          void qc.invalidateQueries({ queryKey: minutesKeys.all })
          router.back()
        })
      }
    ])
  }

  const check = (ok: boolean, label: string): React.ReactElement => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={ok ? p.success : p.textMuted} />
      <MText color={ok ? p.text : p.textMuted} style={{ flex: 1 }}>{label}</MText>
    </View>
  )

  return (
    <Screen>
      <MText size="caption" color={p.textMuted} style={{ marginBottom: spacing.sm }}>
        {d.is_revision ? t('mob.mmUpdatingTo', { n: d.next_version_no }) : t('mob.mmDraftSaved')}
      </MText>
      <SegmentedTabs<Step>
        options={[
          { value: 'details', label: t('mob.mmStepDetails') },
          { value: 'pages', label: t('mob.mmStepPages') },
          { value: 'recording', label: t('mob.mmStepRecording') },
          { value: 'publish', label: t('mob.mmStepPublish') }
        ]}
        value={step}
        onChange={setStep}
      />
      <View style={{ height: spacing.lg }} />

      {step === 'details' ? (
        <View style={{ gap: spacing.md }}>
          <Input label={t('mob.mmReportTitle')} value={title} maxLength={200} onChangeText={setTitle} onEndEditing={() => { if (title.trim() && title.trim() !== d.title) void act('details', () => minutesApi.updateDraft(reportId, { title: title.trim() })) }} />
          <DateField label={t('mob.mmMeetingDate')} value={d.meeting_date} onChange={(v) => void act('details', () => minutesApi.updateDraft(reportId, { meeting_date: v }))} />
          {d.is_revision ? (
            <Input label={t('mob.mmWhatChangedLabel')} value={summary} maxLength={500} multiline onChangeText={setSummary} placeholder={t('mob.mmWhatChangedPh')} onEndEditing={() => { if (summary.trim() !== (d.change_summary ?? '')) void act('details', () => minutesApi.updateDraft(reportId, { change_summary: summary.trim() || null })) }} />
          ) : null}
          <Button label={t('mob.mmNext')} icon="arrow-forward" onPress={() => setStep('pages')} />
        </View>
      ) : null}

      {step === 'pages' ? (
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <MText size="heading" weight="bold">{t('mob.mmPagesN', { n: d.page_count })}</MText>
            <MText size="micro" color={p.textMuted}>{t('mob.mmTapPageHint')}</MText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {d.pages.map((pg, i) => (
              <ScalePressable
                key={pg.id}
                accessibilityRole="button"
                accessibilityLabel={t('mob.mmPageOf', { n: i + 1, total: d.pages.length })}
                onPress={() => setSelected(pg.id)}
                style={{ width: '31.5%', aspectRatio: 0.75, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: p.border, backgroundColor: p.surface }}
              >
                <Image source={{ uri: absolute(pg.thumb_url) ?? undefined }} style={{ flex: 1 }} contentFit="contain" />
                <View style={{ position: 'absolute', left: spacing.xs, top: spacing.xs }}><Pill tone="brand" text={String(i + 1)} /></View>
              </ScalePressable>
            ))}
            {queue.map((q) => (
              <ScalePressable
                key={q.key}
                accessibilityRole="button"
                accessibilityLabel={q.status === 'failed' ? t('mob.mmUploadFailedRetry') : t('mob.mmUploadingPage')}
                disabled={q.status !== 'failed'}
                onPress={() => setQueue((qs) => qs.map((x) => (x.key === q.key ? { ...x, status: 'waiting' } : x)))}
                onLongPress={() => setQueue((qs) => qs.filter((x) => x.key !== q.key))}
                style={{ width: '31.5%', aspectRatio: 0.75, borderRadius: radius.sm, overflow: 'hidden', borderWidth: q.status === 'failed' ? 2 : 1, borderColor: q.status === 'failed' ? p.danger : p.border, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
              >
                <Image source={{ uri: q.uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} contentFit="cover" />
                {q.status === 'failed' ? (
                  <View style={{ alignItems: 'center', gap: spacing.xs, padding: spacing.xs }}>
                    <Ionicons name="refresh" size={22} color={p.danger} />
                    <MText size="micro" weight="semibold" color={p.danger} style={{ textAlign: 'center' }}>{t('mob.mmTapRetry')}</MText>
                  </View>
                ) : <ActivityIndicator color={p.primary} />}
              </ScalePressable>
            ))}
          </View>
          {failed > 0 ? <Callout icon="cloud-offline-outline" tone="warning" text={t('mob.mmSomeFailed', { n: failed })} /> : null}
          {d.page_count + queue.length >= d.max_pages ? <Callout icon="information-circle-outline" tone="warning" text={t('mob.mmMaxPages', { n: d.max_pages })} /> : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}><Button label={t('mob.mmTakePhoto')} icon="camera-outline" disabled={d.page_count + queue.length >= d.max_pages} onPress={() => void takePhoto()} /></View>
            <View style={{ flex: 1 }}><Button label={t('mob.mmFromGallery')} icon="images-outline" variant="secondary" disabled={d.page_count + queue.length >= d.max_pages} onPress={() => void pickPhotos()} /></View>
          </View>
          <Button label={t('mob.mmPreviewPdf')} icon="document-outline" variant="secondary" loading={busy === 'pdf'} disabled={d.page_count === 0 || uploading} onPress={() => void previewPdf()} />
          <Button label={t('mob.mmNext')} icon="arrow-forward" disabled={d.page_count === 0} onPress={() => setStep('recording')} />
        </View>
      ) : null}

      {step === 'recording' ? (
        <View style={{ gap: spacing.md }}>
          {d.audio_url ? (
            <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="headset-outline" size={24} color={p.primary} />
                <MText weight="semibold" style={{ flex: 1 }}>{t('mob.mmRecordingAttached', { d: formatDuration(d.audio_ms) })}</MText>
              </View>
              <Button label={t('mob.mmRemoveRecording')} variant="danger" icon="trash-outline" loading={busy === 'audio'} onPress={() => void act('audio', () => minutesApi.removeAudio(reportId))} />
            </View>
          ) : null}
          {hasAudioPlayback() ? (
            <MinutesRecorder
              reportId={reportId}
              slug={activeProfile?.slug}
              hasAudio={Boolean(d.audio_url)}
              onUploaded={(next) => { apply(next); toast.show('success', t('mob.mmRecUploaded')) }}
            />
          ) : (
            <>
              <Callout icon="mic-outline" tone="warning" text={t('mob.mmRecordUpdate')} />
              <MText size="caption" color={p.textMuted}>{t('mob.mmRecordLater')}</MText>
            </>
          )}
          <Button label={t('mob.mmNext')} icon="arrow-forward" onPress={() => setStep('publish')} />
        </View>
      ) : null}

      {step === 'publish' ? (
        <View style={{ gap: spacing.md }}>
          <View style={[card, { padding: spacing.lg, gap: spacing.xs }]}>
            <MText size="heading" weight="bold">{title}</MText>
            <MText size="caption" color={p.textMuted}>{t('mob.mmMeetingOn', { date: formatDate(d.meeting_date) })}</MText>
            <MText size="caption" color={p.textMuted}>{t('mob.mmPagesN', { n: d.page_count })}{d.audio_url ? ` · ${t('mob.mmRecordingN', { d: formatDuration(d.audio_ms) })}` : ''}</MText>
          </View>
          {d.is_revision ? (
            <>
              <Input label={t('mob.mmWhatChangedLabel')} value={summary} maxLength={500} multiline onChangeText={setSummary} placeholder={t('mob.mmWhatChangedPh')} />
              <View style={[card, { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }]}>
                <View style={{ flex: 1 }}>
                  <MText weight="semibold">{t('mob.mmNotifyMembers')}</MText>
                  <MText size="caption" color={p.textMuted}>{t('mob.mmNotifyHint')}</MText>
                </View>
                <Switch value={notify} onValueChange={setNotify} accessibilityLabel={t('mob.mmNotifyMembers')} trackColor={{ true: p.primary, false: p.borderStrong }} thumbColor={p.surface} />
              </View>
            </>
          ) : null}
          <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
            {check(title.trim() !== '', t('mob.mmCheckDetails'))}
            {check(d.page_count > 0 && !uploading, t('mob.mmCheckPages', { n: d.page_count }))}
            {check(!audioPending, d.audio_url ? t('mob.mmCheckAudio') : t('mob.mmCheckNoAudio'))}
            {d.is_revision ? check(summary.trim() !== '', t('mob.mmCheckSummary')) : null}
          </View>
          <Button label={d.is_revision ? t('mob.mmPublishVersion', { n: d.next_version_no }) : t('mob.mmPublish')} icon="send-outline" loading={busy === 'publish'} disabled={!ready} onPress={confirmPublish} />
          <Button label={t('mob.mmDiscardDraft')} variant="secondary" icon="trash-outline" loading={busy === 'discard'} onPress={discard} />
        </View>
      ) : null}
      <View style={{ height: spacing.xl }} />

      <BottomSheet visible={page !== null} onClose={() => setSelected(null)} title={page ? t('mob.mmPageOf', { n: pageIndex + 1, total: d.pages.length }) : ''}>
        {page ? (
          <View style={{ gap: spacing.sm }}>
            <ScalePressable accessibilityRole="imagebutton" accessibilityLabel={t('mob.mmTapToZoom')} onPress={() => setZoom(true)} style={{ height: 220, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: p.surfaceAlt }}>
              <Image source={{ uri: absolute(page.url) ?? undefined }} placeholder={{ uri: absolute(page.thumb_url) ?? undefined }} style={{ flex: 1 }} contentFit="contain" />
            </ScalePressable>
            <View style={[card, { paddingVertical: 0 }]}>
              <ListRow first icon="arrow-back-outline" label={t('mob.mmMoveEarlier')} onPress={() => { if (pageIndex > 0) move(pageIndex, pageIndex - 1) }} />
              <ListRow icon="arrow-forward-outline" label={t('mob.mmMoveLater')} onPress={() => { if (pageIndex < d.pages.length - 1) move(pageIndex, pageIndex + 1) }} />
              <ListRow icon="play-skip-back-outline" label={t('mob.mmMoveFirst')} onPress={() => move(pageIndex, 0)} />
              <ListRow icon="refresh-outline" label={busy === 'rotate' ? t('mob.mmRotating') : t('mob.mmRotate')} onPress={() => void act('rotate', () => minutesApi.rotate(reportId, page.id))} />
              <ListRow
                icon="swap-horizontal-outline"
                label={t('mob.mmReplace')}
                onPress={() => {
                  const target = page.id
                  setSelected(null)
                  Alert.alert(t('mob.mmReplace'), undefined, [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('mob.mmFromGallery'), onPress: () => void pickPhotos(target) },
                    { text: t('mob.mmTakePhoto'), onPress: () => void takePhoto(target) }
                  ])
                }}
              />
              <ListRow
                icon="trash-outline"
                iconTone="danger"
                label={t('mob.mmRemovePage')}
                onPress={() => {
                  const target = page.id
                  Alert.alert(t('mob.mmRemovePageQ'), undefined, [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('mob.mmRemove'), style: 'destructive', onPress: () => { setSelected(null); void act('remove', () => minutesApi.removePage(reportId, target)) } }
                  ])
                }}
              />
            </View>
          </View>
        ) : null}
      </BottomSheet>
      {page ? <PhotoViewer photos={[absolute(page.url) ?? '']} initialIndex={0} visible={zoom} onClose={() => setZoom(false)} /> : null}
    </Screen>
  )
}
