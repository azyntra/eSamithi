import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { useFocusEffect } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { radius, spacing, usePalette } from '../theme'
import { useT } from '../i18n'
import { formatDuration } from '../api/minutes'
import { ScalePressable } from './pressable'
import { useCardStyle } from './v2'
import { MText } from './minutes'

const SPEEDS = [1, 1.25, 1.5, 0.75] as const

// The Secretary reading the minutes (§8.1.2): play/pause, a scrubber you can
// tap anywhere, back and forward 15 s, elapsed and total time, speed. It
// keeps playing while pages are swiped; it pauses when the screen is left.
// The first signed link is kept for the whole session (a refreshed report
// must not restart the reading); the server gives recordings 3-hour links.
export function MinutesPlayer({ url, durationMs, seekToMs, onSeekHandled }: { url: string; durationMs: number | null; seekToMs?: number | null; onSeekHandled?: () => void }): React.ReactElement {
  const p = usePalette()
  const card = useCardStyle()
  const { t } = useT()
  const [source] = useState(() => ({ uri: url }))
  const player = useAudioPlayer(source, { updateInterval: 500 })
  const status = useAudioPlayerStatus(player)
  const [speed, setSpeed] = useState(0)
  const [width, setWidth] = useState(1)
  const [failed, setFailed] = useState(false)
  const pendingSeek = useRef<number | null>(null)

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix', allowsRecording: false }).catch(() => {})
  }, [])

  // Leaving the report pauses the reading; coming back continues from there
  useFocusEffect(useCallback(() => () => { try { player.pause() } catch { /* released */ } }, [player]))

  useEffect(() => {
    if (status.error) setFailed(true)
  }, [status.error])

  const total = status.duration > 0 ? status.duration : (durationMs ?? 0) / 1000
  const now = Math.min(status.currentTime, total || status.currentTime)

  const seek = useCallback((seconds: number) => {
    const target = Math.max(0, total > 0 ? Math.min(seconds, total - 0.5) : seconds)
    player.seekTo(target).catch(() => {})
  }, [player, total])

  // "12:34" in a comment opens the reader at that moment
  useEffect(() => {
    if (seekToMs === null || seekToMs === undefined) return
    if (!status.isLoaded) { pendingSeek.current = seekToMs; return }
    seek(seekToMs / 1000)
    player.play()
    onSeekHandled?.()
  }, [seekToMs, status.isLoaded, seek, player, onSeekHandled])
  useEffect(() => {
    if (status.isLoaded && pendingSeek.current !== null) {
      seek(pendingSeek.current / 1000)
      player.play()
      pendingSeek.current = null
      onSeekHandled?.()
    }
  }, [status.isLoaded, seek, player, onSeekHandled])

  const toggle = (): void => {
    if (status.playing) player.pause()
    else {
      if (status.didJustFinish || (total > 0 && now >= total - 0.5)) seek(0)
      player.play()
    }
  }
  const cycleSpeed = (): void => {
    const next = (speed + 1) % SPEEDS.length
    setSpeed(next)
    player.setPlaybackRate(SPEEDS[next])
  }
  const onBarPress = (e: GestureResponderEvent): void => {
    if (total > 0) seek((e.nativeEvent.locationX / width) * total)
  }
  const retry = (): void => {
    setFailed(false)
    player.replace({ uri: url })
  }

  const fraction = total > 0 ? Math.min(1, now / total) : 0
  const label = `${formatDuration(now * 1000) || '0:00'} / ${formatDuration(total * 1000) || '—'}`

  if (failed) {
    return (
      <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
        <MText weight="semibold">{t('mob.mmAudioFailed')}</MText>
        <ScalePressable accessibilityRole="button" onPress={retry} style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: p.primarySoft, justifyContent: 'center' }}>
          <MText weight="semibold" color={p.primaryOnSoft}>{t('mob.mmRetry')}</MText>
        </ScalePressable>
      </View>
    )
  }

  const round = (icon: keyof typeof Ionicons.glyphMap, a11y: string, onPress: () => void, size = 44, primary = false): React.ReactElement => (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      haptic="selection"
      onPress={onPress}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: primary ? p.primary : p.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
    >
      {primary && !status.isLoaded ? <ActivityIndicator color={p.onPrimary} /> : <Ionicons name={icon} size={primary ? 26 : 20} color={primary ? p.onPrimary : p.text} />}
    </ScalePressable>
  )

  return (
    <View style={[card, { padding: spacing.md + 2, gap: spacing.sm }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {round(status.playing ? 'pause' : 'play', status.playing ? t('mob.mmPause') : t('mob.mmPlay'), toggle, 56, true)}
        <View style={{ flex: 1 }}>
          <MText size="caption" weight="semibold">{t('mob.mmSecretaryReading')}</MText>
          <MText size="micro" color={p.textMuted}>{label}</MText>
        </View>
        {round('play-back-outline', t('mob.mmBack15'), () => seek(now - 15))}
        {round('play-forward-outline', t('mob.mmForward15'), () => seek(now + 15))}
        <ScalePressable
          accessibilityRole="button"
          accessibilityLabel={t('mob.mmSpeed', { x: String(SPEEDS[speed]) })}
          onPress={cycleSpeed}
          style={{ minWidth: 48, height: 44, borderRadius: 22, backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm }}
        >
          <MText size="caption" weight="semibold">{`${SPEEDS[speed]}×`}</MText>
        </ScalePressable>
      </View>
      <ScalePressable
        accessibilityRole="adjustable"
        accessibilityLabel={t('mob.mmPosition')}
        accessibilityValue={{ min: 0, max: Math.round(total), now: Math.round(now), text: label }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => seek(e.nativeEvent.actionName === 'increment' ? now + 15 : now - 15)}
        onPress={onBarPress}
        onLayout={(e: LayoutChangeEvent) => setWidth(Math.max(1, e.nativeEvent.layout.width))}
        scaleTo={1}
        style={{ height: 32, justifyContent: 'center' }}
      >
        <View style={{ height: 6, borderRadius: 3, backgroundColor: p.surfaceAlt }} />
        <View style={{ position: 'absolute', left: 0, height: 6, borderRadius: 3, width: `${fraction * 100}%`, backgroundColor: p.primary }} />
        <View style={{ position: 'absolute', left: `${fraction * 100}%`, marginLeft: -9, width: 18, height: 18, borderRadius: 9, backgroundColor: p.primary, borderWidth: 3, borderColor: p.surface }} />
      </ScalePressable>
    </View>
  )
}
