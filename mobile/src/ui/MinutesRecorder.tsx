import React, { useEffect, useRef, useState } from 'react'
import { Alert, Linking, View } from 'react-native'
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState, type RecordingOptions } from 'expo-audio'
import { File, Paths } from 'expo-file-system'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as SecureStore from 'expo-secure-store'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing, usePalette } from '../theme'
import { useT } from '../i18n'
import { uuid4 } from '../lib/attendance'
import { formatDuration, uploadRecording, type MinutesDraft } from '../api/minutes'
import { ProgressBar } from './index'
import { ScalePressable } from './pressable'
import { useCardStyle } from './v2'
import { MText } from './minutes'

// Speech, small on 3G: AAC in .m4a, mono, 64 kbps — about 29 MB an hour
// (§6.5). Written to the app's documents folder so it survives until it is
// uploaded, not to the cache the system may clear.
const VOICE: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  directory: 'document'
}
const MAX_MS = 90 * 60 * 1000
const WARN_MS = 85 * 60 * 1000
const KEEP_AWAKE = 'minutes-recording'

interface Pending { uri: string; durationMs: number | null; uploadId: string; name?: string }
type Phase = 'idle' | 'recording' | 'paused' | 'review' | 'uploading' | 'failed'

const pendingKey = (slug: string | undefined, reportId: number): string => `esamithi.mm.rec.${slug ?? 'default'}.${reportId}`

function removeFile(uri: string): void {
  try {
    const f = new File(uri)
    if (f.exists) f.delete()
  } catch { /* already gone */ }
}

// Recording the reading (§8.2.4): start, pause, resume, stop; listen back;
// keep it, record again or choose a file instead; upload in pieces.
export function MinutesRecorder({ reportId, slug, hasAudio, onUploaded }: { reportId: number; slug?: string; hasAudio: boolean; onUploaded: (draft: MinutesDraft) => void }): React.ReactElement {
  const p = usePalette()
  const card = useCardStyle()
  const { t } = useT()
  const recorder = useAudioRecorder(VOICE)
  const state = useAudioRecorderState(recorder, 250)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, setPending] = useState<Pending | null>(null)
  const [restored, setRestored] = useState(false)
  const [interrupted, setInterrupted] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, total: 1 })
  const [levels, setLevels] = useState<number[]>([])
  const warned = useRef(false)
  // When recording last (re)started: the recorder's own state lags a moment
  const startedAt = useRef(0)
  const key = pendingKey(slug, reportId)

  // A recording made earlier but not yet uploaded is offered back
  useEffect(() => {
    SecureStore.getItemAsync(key).then((raw) => {
      if (!raw) return
      const saved = JSON.parse(raw) as Pending
      if (new File(saved.uri).exists) {
        setPending(saved)
        setRestored(true)
        setPhase('review')
      } else SecureStore.deleteItemAsync(key).catch(() => {})
    }).catch(() => {})
  }, [key])

  // Level meter while recording, and the 85/90-minute limits
  useEffect(() => {
    if (phase !== 'recording') return
    const db = typeof state.metering === 'number' ? state.metering : -60
    setLevels((ls) => [...ls.slice(-27), Math.max(0.08, Math.min(1, (db + 60) / 60))])
    if (state.durationMillis >= WARN_MS && !warned.current) {
      warned.current = true
      Alert.alert(t('mob.mmRecNearLimit'), t('mob.mmRecNearLimitBody'))
    }
    if (state.durationMillis >= MAX_MS) void stop()
    // A phone call or another app took the microphone: the recorder stops
    // itself; show it as paused so the Secretary can carry on
    if (!state.isRecording && state.durationMillis > 0 && Date.now() - startedAt.current > 1500) {
      setPhase('paused')
      setInterrupted(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.durationMillis, state.metering, state.isRecording])

  useEffect(() => () => { deactivateKeepAwake(KEEP_AWAKE).catch(() => {}) }, [])

  const savePending = (next: Pending | null): void => {
    setPending(next)
    ;(next ? SecureStore.setItemAsync(key, JSON.stringify(next)) : SecureStore.deleteItemAsync(key)).catch(() => {})
  }

  const start = async (): Promise<void> => {
    const perm = await requestRecordingPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('mob.mmMicOff'), t('mob.mmMicOffBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('mob.mmOpenSettings'), onPress: () => { Linking.openSettings().catch(() => {}) } }
      ])
      return
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false })
      await recorder.prepareToRecordAsync()
      recorder.record()
      startedAt.current = Date.now()
      warned.current = false
      setLevels([])
      setInterrupted(false)
      setPhase('recording')
      activateKeepAwakeAsync(KEEP_AWAKE).catch(() => {})
    } catch {
      Alert.alert(t('mob.mmRecFailed'), t('mob.mmRecFailedBody'))
    }
  }

  const pause = (): void => {
    recorder.pause()
    setPhase('paused')
  }
  const resume = (): void => {
    recorder.record()
    startedAt.current = Date.now()
    setInterrupted(false)
    setPhase('recording')
  }

  async function stop(): Promise<void> {
    const duration = state.durationMillis
    try {
      await recorder.stop()
    } finally {
      deactivateKeepAwake(KEEP_AWAKE).catch(() => {})
      setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {})
    }
    const uri = recorder.uri ?? state.url
    if (!uri) {
      setPhase('idle')
      Alert.alert(t('mob.mmRecFailed'), t('mob.mmRecFailedBody'))
      return
    }
    savePending({ uri, durationMs: duration || null, uploadId: uuid4() })
    setRestored(false)
    setPhase('review')
  }

  const discard = (): void => {
    Alert.alert(t('mob.mmRecDeleteQ'), t('mob.mmRecDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('mob.mmRecDelete'),
        style: 'destructive',
        onPress: () => {
          if (pending) removeFile(pending.uri)
          savePending(null)
          setPhase('idle')
        }
      }
    ])
  }

  const chooseFile = async (): Promise<void> => {
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ['audio/*'] })
      if (picked.canceled || !picked.result) return
      const src = picked.result
      const ext = (src.extension || '.m4a').toLowerCase()
      const copy = new File(Paths.document, `minutes-${reportId}-${uuid4()}${ext.startsWith('.') ? ext : `.${ext}`}`)
      await src.copy(copy)
      if (pending) removeFile(pending.uri)
      savePending({ uri: copy.uri, durationMs: null, uploadId: uuid4(), name: src.name })
      setRestored(false)
      setPhase('review')
    } catch {
      Alert.alert(t('mob.mmPickFailed'), t('mob.mmPickFailedBody'))
    }
  }

  const upload = async (): Promise<void> => {
    if (!pending) return
    setPhase('uploading')
    setProgress({ sent: 0, total: 1 })
    try {
      const draft = await uploadRecording(reportId, pending.uri, pending.uploadId, pending.durationMs, (sent, total) => setProgress({ sent, total }))
      removeFile(pending.uri)
      savePending(null)
      setPhase('idle')
      onUploaded(draft)
    } catch {
      setPhase('failed')
    }
  }

  const big = (icon: keyof typeof Ionicons.glyphMap, label: string, onPress: () => void, tone: 'primary' | 'danger' | 'soft'): React.ReactElement => {
    const bg = tone === 'primary' ? p.primary : tone === 'danger' ? p.danger : p.primarySoft
    const fg = tone === 'soft' ? p.primaryOnSoft : p.onPrimary
    return (
      <ScalePressable accessibilityRole="button" haptic="impact" onPress={onPress} style={{ flex: 1, minHeight: 64, borderRadius: 32, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }}>
        <Ionicons name={icon} size={22} color={fg} />
        <MText weight="semibold" color={fg}>{label}</MText>
      </ScalePressable>
    )
  }

  if (phase === 'recording' || phase === 'paused') {
    const live = phase === 'recording'
    return (
      <View style={[card, { padding: spacing.lg, gap: spacing.md, alignItems: 'center' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: live ? p.dangerBg : p.warningBg }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live ? p.danger : p.warning }} />
          <MText size="caption" weight="semibold" color={live ? p.danger : p.warning}>{live ? t('mob.mmRecording') : t('mob.mmPaused')}</MText>
        </View>
        <MText size="hero" weight="bold" accessibilityLiveRegion="polite" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(state.durationMillis) || '0:00'}</MText>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 48, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          {levels.map((l, i) => <View key={i} style={{ width: 5, height: Math.round(6 + l * 42), borderRadius: 3, backgroundColor: live ? p.primary : p.border }} />)}
        </View>
        {interrupted ? <MText size="caption" weight="semibold" color={p.warning} style={{ textAlign: 'center' }}>{t('mob.mmRecInterrupted')}</MText> : null}
        <View style={{ flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch' }}>
          {live ? big('pause', t('mob.mmPause'), pause, 'soft') : big('mic', t('mob.mmResume'), resume, 'soft')}
          {big('stop', t('mob.mmStop'), () => void stop(), 'danger')}
        </View>
        <MText size="micro" color={p.textMuted} style={{ textAlign: 'center' }}>{t('mob.mmRecScreenOn')}</MText>
      </View>
    )
  }

  if ((phase === 'review' || phase === 'failed' || phase === 'uploading') && pending) {
    return (
      <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
        {restored ? <MText size="caption" weight="semibold" color={p.warning}>{t('mob.mmRecRestored')}</MText> : null}
        <ReviewPlayer uri={pending.uri} title={pending.name ?? t('mob.mmYourRecording')} durationMs={pending.durationMs} />
        {phase === 'uploading' ? (
          <View style={{ gap: spacing.xs }} accessibilityLiveRegion="polite">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <MText size="caption" weight="semibold">{t('mob.mmUploadingRec')}</MText>
              <MText size="caption" color={p.textMuted}>{`${(progress.sent / 1048576).toFixed(1)} / ${(progress.total / 1048576).toFixed(1)} MB`}</MText>
            </View>
            <ProgressBar value={progress.sent / Math.max(1, progress.total)} />
            <MText size="micro" color={p.textMuted}>{t('mob.mmUploadResumes')}</MText>
          </View>
        ) : (
          <>
            {phase === 'failed' ? <MText size="caption" weight="semibold" color={p.danger}>{t('mob.mmUploadFailed')}</MText> : null}
            {big('cloud-upload-outline', phase === 'failed' ? t('mob.mmResumeUpload') : t('mob.mmUseRecording'), () => void upload(), 'primary')}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>{big('refresh', t('mob.mmRecordAgain'), discard, 'soft')}</View>
              <View style={{ flex: 1 }}>{big('document-attach-outline', t('mob.mmChooseFile'), () => void chooseFile(), 'soft')}</View>
            </View>
          </>
        )}
      </View>
    )
  }

  return (
    <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
      <MText color={p.textMuted}>{hasAudio ? t('mob.mmRecReplaceIntro') : t('mob.mmRecIntro')}</MText>
      {big('mic', hasAudio ? t('mob.mmRecordNew') : t('mob.mmStartRecording'), () => void start(), 'primary')}
      <ScalePressable accessibilityRole="button" onPress={() => void chooseFile()} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        <MText weight="semibold" color={p.primary}>{t('mob.mmChooseFile')}</MText>
      </ScalePressable>
    </View>
  )
}

// Listen back before keeping a recording
function ReviewPlayer({ uri, title, durationMs }: { uri: string; title: string; durationMs: number | null }): React.ReactElement {
  const p = usePalette()
  const { t } = useT()
  const [source] = useState(() => ({ uri }))
  const player = useAudioPlayer(source, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)
  const total = status.duration > 0 ? status.duration * 1000 : durationMs ?? 0
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={status.playing ? t('mob.mmPause') : t('mob.mmPlay')}
        onPress={() => {
          if (status.playing) player.pause()
          else {
            if (status.didJustFinish) player.seekTo(0).catch(() => {})
            player.play()
          }
        }}
        style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={24} color={p.primaryOnSoft} />
      </ScalePressable>
      <View style={{ flex: 1 }}>
        <MText weight="semibold" numberOfLines={1}>{title}</MText>
        <MText size="caption" color={p.textMuted}>{`${formatDuration(status.currentTime * 1000) || '0:00'} / ${formatDuration(total) || '—'}`}</MText>
      </View>
    </View>
  )
}
