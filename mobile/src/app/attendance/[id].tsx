import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AppState, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { useKeepAwake } from 'expo-keep-awake'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { useIsFocused, useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../../i18n'
import { radius, spacing, usePalette } from '../../theme'
import { interFamily, useType } from '../../typography'
import {
  attendanceKeys,
  lookupAttendanceMembers,
  markAttendance,
  unmarkAttendance,
  useAttendanceRoster,
  type AttendanceLookupRow,
  type AttendanceMarkResult,
  type AttendanceRosterRow
} from '../../api/hooks'
import { classifyMarkError, createRepeatGuard, parseCardPayload, uuid4 } from '../../lib/attendance'
import { formatTime } from '../../lib/date'
import { Button, Card, EmptyText, ErrorView, ListRow, Screen, Segmented, SkeletonCards, useToast } from '../../ui'

// The attendance scanner (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §4.4).
// Scan: continuous camera QR reading with a result card, haptics and undo.
// Search: mark members who have no card to scan. List: present/absent with
// undo for the marks you made. Scans that cannot reach the server are kept
// on screen and retried — never shown as "marked" until the server says so.

type Tab = 'scan' | 'search' | 'list'

type ScanResult =
  | { kind: 'marked'; res: AttendanceMarkResult }
  | { kind: 'already'; res: AttendanceMarkResult }
  | { kind: 'not_found'; code: string }
  | { kind: 'not_card' }
  | { kind: 'pending'; label: string }

interface PendingMark {
  ref: string
  label: string
  body: { society_id?: string; member_id?: number }
}

const RESULT_MS = 4000

export default function AttendanceScanner(): React.ReactElement {
  useKeepAwake() // FR-4.11: the screen stays on while marking
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const router = useRouter()
  const navigation = useNavigation()
  const toast = useToast()
  const queryClient = useQueryClient()
  const { id } = useLocalSearchParams<{ id: string }>()
  const eventId = Number(id)
  const roster = useAttendanceRoster(eventId)
  const focused = useIsFocused()
  const [permission, requestPermission] = useCameraPermissions()

  const mode = roster.data?.event.attendance_mode ?? 'present'
  // An absentee is not there to be scanned: "mark absentees" events open on
  // the list instead of the camera (FR-4.10)
  const [tab, setTab] = useState<Tab | null>(null)
  const activeTab: Tab = tab ?? (mode === 'absent' ? 'list' : 'scan')

  const [appActive, setAppActive] = useState(AppState.currentState === 'active')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'))
    return () => sub.remove()
  }, [])

  const [torch, setTorch] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pending, setPending] = useState<PendingMark[]>([])
  const [busy, setBusy] = useState(false)
  const guard = useRef(createRepeatGuard(3000)).current
  const inFlight = useRef(new Set<string>())

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: attendanceKeys.roster(eventId) })
    void queryClient.invalidateQueries({ queryKey: attendanceKeys.events })
  }, [queryClient, eventId])

  const showResult = useCallback((r: ScanResult) => {
    if (resultTimer.current) clearTimeout(resultTimer.current)
    setResult(r)
    resultTimer.current = setTimeout(() => setResult(null), RESULT_MS)
  }, [])
  useEffect(() => () => { if (resultTimer.current) clearTimeout(resultTimer.current) }, [])

  // Permission removed, feature switched off, or the event left the window:
  // nothing more can be done here (FR-2.3)
  const leaveWith = useCallback((message: string, home: boolean) => {
    void queryClient.invalidateQueries({ queryKey: ['me', 'profile'] })
    Alert.alert(t('mob.attTitle'), message, [{ text: t('common.close'), onPress: () => (home ? router.replace('/') : router.back()) }])
  }, [queryClient, router, t])

  const send = useCallback(async (body: PendingMark['body'], label: string, ref: string, fromQueue = false): Promise<boolean> => {
    try {
      const res = await markAttendance(eventId, { ...body, client_ref: ref })
      if (res.already && !res.mine) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
        if (!fromQueue) showResult({ kind: 'already', res })
      } else if (res.already) {
        // Re-sent from the queue, or a repeat of my own scan
        if (!fromQueue) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
          showResult({ kind: 'already', res })
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
        if (!fromQueue) showResult({ kind: 'marked', res })
      }
      refresh()
      return true
    } catch (err) {
      const f = classifyMarkError(err)
      if (f.kind === 'offline') {
        if (!fromQueue) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
          setPending((q) => (q.some((x) => x.ref === ref) ? q : [...q, { ref, label, body }]))
          showResult({ kind: 'pending', label })
        }
        return false
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      if (f.kind === 'not_found') showResult({ kind: 'not_found', code: label })
      else if (f.kind === 'not_staff') leaveWith(t('mob.attNotStaff'), true)
      else if (f.kind === 'closed') leaveWith(t('mob.attClosed'), false)
      else if (f.kind === 'rate_limited') toast.show('error', t('mob.attSlowDown'))
      else toast.show('error', f.message)
      return true // handled: never retry a refusal
    }
  }, [eventId, leaveWith, refresh, showResult, t, toast])

  // Retry anything that could not be sent, every few seconds and whenever
  // the app comes back to the front
  useEffect(() => {
    if (pending.length === 0 || !appActive) return
    const tick = async () => {
      for (const item of pending) {
        const done = await send(item.body, item.label, item.ref, true)
        if (done) setPending((q) => q.filter((x) => x.ref !== item.ref))
        else break // still offline: try again on the next tick
      }
    }
    void tick()
    const timer = setInterval(() => void tick(), 5000)
    return () => clearInterval(timer)
  }, [pending, appActive, send])

  // Warn before leaving with scans not yet sent (§7.7 step 4)
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (pending.length === 0) return
      e.preventDefault()
      Alert.alert(t('mob.attTitle'), t('mob.attLeavePending', { count: pending.length }), [
        { text: t('mob.attStay'), style: 'cancel' },
        { text: t('mob.attLeave'), style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) }
      ])
    })
  }, [navigation, pending.length, t])

  const onScanned = useCallback((scan: BarcodeScanningResult) => {
    const raw = scan.data
    if (!guard(raw)) return
    const code = parseCardPayload(raw)
    if (!code) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      showResult({ kind: 'not_card' })
      return
    }
    const key = code.toLowerCase()
    if (inFlight.current.has(key)) return
    inFlight.current.add(key)
    void send({ society_id: code }, code, uuid4()).finally(() => inFlight.current.delete(key))
  }, [guard, send, showResult])

  const undo = useCallback(async (memberId: number) => {
    setBusy(true)
    try {
      await unmarkAttendance(eventId, memberId)
      Haptics.selectionAsync().catch(() => {})
      toast.show('success', t('mob.attUndone'))
      setResult(null)
      refresh()
    } catch (err) {
      const f = classifyMarkError(err)
      if (f.kind === 'not_staff') leaveWith(t('mob.attNotStaff'), true)
      else toast.show('error', t('mob.attUndoFailed'))
    } finally {
      setBusy(false)
    }
  }, [eventId, leaveWith, refresh, t, toast])

  const confirmManual = useCallback((m: { member_id: number; society_id: string; full_name: string | null }) => {
    const name = m.full_name || m.society_id
    Alert.alert(t('mob.attTitle'), t('mob.attConfirmMark', { name, id: m.society_id, state: mode === 'absent' ? t('mob.attStateAbsent') : t('mob.attStatePresent') }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mob.attMark'), onPress: () => void send({ member_id: m.member_id }, name, uuid4()) }
    ])
  }, [mode, send, t])

  // Marked side = the list that holds individual marks in this event's method
  const markedSide: 'present' | 'absent' = mode === 'absent' ? 'absent' : 'present'
  const byMe = useMemo(() => (roster.data ? roster.data[markedSide].filter((r) => r.mine).length : 0), [roster.data, markedSide])

  if (roster.isPending) return <Screen><SkeletonCards cards={2} /></Screen>
  if (roster.isError && !roster.data) {
    const f = classifyMarkError(roster.error)
    if (f.kind === 'not_staff' || f.kind === 'closed') {
      return (
        <Screen>
          <EmptyText>{f.kind === 'not_staff' ? t('mob.attNotStaff') : t('mob.attClosed')}</EmptyText>
          <Button label={t('common.close')} variant="secondary" onPress={() => router.back()} />
        </Screen>
      )
    }
    return (
      <Screen refreshing={roster.isRefetching} onRefresh={() => roster.refetch()}>
        <ErrorView onRetry={() => roster.refetch()} />
      </Screen>
    )
  }

  const data = roster.data!
  const cameraOn = activeTab === 'scan' && focused && appActive && permission?.granted === true

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {/* Header: what, and how far along */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 4 }}>
        <Text numberOfLines={2} style={{ color: p.text, fontSize: 18, fontFamily: ty.family.bold, lineHeight: ty.lh(18) }}>
          {data.event.title}
        </Text>
        <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14) }}>
          {t('mob.attPresentCount', { count: data.present.length })}
          {'  ·  '}
          {t('mob.attByYou', { count: byMe })}
        </Text>
        {pending.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: p.warningBg, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 }}>
            <Ionicons name="cloud-offline-outline" size={16} color={p.warning} />
            <Text style={{ color: p.warning, fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14), flex: 1 }}>
              {t('mob.attPending', { count: pending.length })}
            </Text>
          </View>
        )}
        <View style={{ marginTop: 6 }}>
          <Segmented<Tab>
            options={[
              { value: 'scan', label: t('mob.attScan') },
              { value: 'search', label: t('mob.attSearch') },
              { value: 'list', label: t('mob.attList') }
            ]}
            value={activeTab}
            onChange={setTab}
          />
        </View>
      </View>

      {activeTab === 'scan' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
          {mode === 'absent' && <Note text={t('mob.attAbsentModeNote')} />}
          {!permission ? null : !permission.granted ? (
            <Card>
              <Text style={{ color: p.text, fontSize: 16, fontFamily: ty.family.bold, lineHeight: ty.lh(16) }}>{t('mob.attCameraTitle')}</Text>
              <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14), marginTop: 6, marginBottom: 8 }}>{t('mob.attCameraBody')}</Text>
              {permission.canAskAgain ? (
                <Button label={t('mob.attCameraAllow')} icon="camera-outline" onPress={() => void requestPermission()} />
              ) : (
                <Button label={t('mob.attOpenSettings')} icon="settings-outline" variant="secondary" onPress={() => void Linking.openSettings()} />
              )}
            </Card>
          ) : (
            <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000', aspectRatio: 1 }}>
              {/* Unmounted, not just hidden, when unfocused or backgrounded:
                  only one camera preview can run at a time, and the
                  `active` prop is iOS-only. */}
              {cameraOn && (
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  enableTorch={torch}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onScanned}
                />
              )}
              <View pointerEvents="none" style={{ position: 'absolute', left: '18%', top: '18%', right: '18%', bottom: '18%', borderWidth: 3, borderColor: 'rgba(255,255,255,0.85)', borderRadius: radius.md }} />
              <Pressable
                onPress={() => setTorch((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={torch ? t('mob.attTorchOff') : t('mob.attTorchOn')}
                style={{ position: 'absolute', right: 12, top: 12, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: torch ? '#facc15' : 'rgba(0,0,0,0.55)' }}
              >
                <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={22} color={torch ? '#111' : '#fff'} />
              </Pressable>
              <Text pointerEvents="none" style={{ position: 'absolute', bottom: 12, left: 12, right: 12, textAlign: 'center', color: '#fff', fontSize: 14, fontFamily: ty.family.semibold, lineHeight: ty.lh(14), textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 }}>
                {t('mob.attPointCamera')}
              </Text>
            </View>
          )}
          {result && <ResultCard result={result} onUndo={undo} busy={busy} />}
        </ScrollView>
      )}

      {activeTab === 'search' && <SearchTab mode={mode} onPick={confirmManual} result={result} onUndo={undo} busy={busy} />}

      {activeTab === 'list' && (
        <ListTab
          present={data.present}
          absent={data.absent}
          mode={mode}
          refreshing={roster.isRefetching}
          onRefresh={() => roster.refetch()}
          onMark={confirmManual}
          onUndo={undo}
          busy={busy}
        />
      )}
    </View>
  )
}

function Note({ text }: { text: string }): React.ReactElement {
  const p = usePalette()
  const ty = useType()
  return (
    <View style={{ flexDirection: 'row', gap: 8, backgroundColor: p.primarySoft, borderRadius: radius.md, padding: spacing.md }}>
      <Ionicons name="information-circle-outline" size={18} color={p.primaryOnSoft} />
      <Text style={{ flex: 1, color: p.primaryOnSoft, fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14) }}>{text}</Text>
    </View>
  )
}

// Big, glanceable, colour + icon + words + haptic — never colour alone (NFR-6)
function ResultCard({ result, onUndo, busy }: { result: ScanResult; onUndo: (memberId: number) => void; busy: boolean }): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()

  let tone: { fg: string; bg: string; icon: keyof typeof Ionicons.glyphMap }
  let heading: string
  let name: string | null = null
  let sub: string | null = null
  let undoId: number | null = null

  switch (result.kind) {
    case 'marked': {
      const { res } = result
      tone = { fg: p.success, bg: p.successBg, icon: 'checkmark-circle' }
      heading = res.meaning === 'absent' ? t('mob.attMarkedAbsent') : t('mob.attMarked')
      name = res.member.full_name || res.member.society_id
      sub = res.member.society_id
      if (res.member.is_active === 0) {
        tone = { fg: p.warning, bg: p.warningBg, icon: 'alert-circle' }
        sub = `${res.member.society_id} · ${t('mob.attInactive')}`
      }
      undoId = res.member.id
      break
    }
    case 'already': {
      const { res } = result
      tone = { fg: p.warning, bg: p.warningBg, icon: 'repeat' }
      heading = t('mob.attAlready')
      name = res.member.full_name || res.member.society_id
      sub = res.marked_at ? t('mob.attAlreadyBy', { time: formatTime(res.marked_at), name: res.mine ? t('mob.attMine') : res.marked_by_name || t('mob.attByOffice') }) : res.member.society_id
      break
    }
    case 'not_found':
      tone = { fg: p.danger, bg: p.dangerBg, icon: 'close-circle' }
      heading = t('mob.attNotFound', { id: result.code })
      break
    case 'not_card':
      tone = { fg: p.danger, bg: p.dangerBg, icon: 'close-circle' }
      heading = t('mob.attNotCard')
      break
    case 'pending':
      tone = { fg: p.warning, bg: p.warningBg, icon: 'cloud-offline-outline' }
      heading = t('mob.attOffline')
      name = result.label
      break
  }

  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: tone.bg, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <Ionicons name={tone.icon} size={40} color={tone.fg} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: tone.fg, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }}>{heading}</Text>
        {name ? <Text style={{ color: p.text, fontSize: 22, fontFamily: ty.family.extrabold, lineHeight: ty.lh(22), marginTop: 2 }}>{name}</Text> : null}
        {sub ? <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: interFamily.bold, lineHeight: ty.lh(14), marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {undoId !== null && (
        <Pressable
          onPress={() => onUndo(undoId as number)}
          disabled={busy}
          accessibilityRole="button"
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5, borderColor: tone.fg, opacity: busy ? 0.5 : 1 }}
        >
          <Text style={{ color: tone.fg, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }}>{t('mob.attUndo')}</Text>
        </Pressable>
      )}
    </View>
  )
}

function SearchTab({
  mode,
  onPick,
  result,
  onUndo,
  busy
}: {
  mode: 'present' | 'absent'
  onPick: (m: AttendanceLookupRow) => void
  result: ScanResult | null
  onUndo: (memberId: number) => void
  busy: boolean
}): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AttendanceLookupRow[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setRows(null)
      return
    }
    let live = true
    setLoading(true)
    const timer = setTimeout(() => {
      lookupAttendanceMembers(term)
        .then((r) => { if (live) setRows(r) })
        .catch(() => { if (live) setRows([]) })
        .finally(() => { if (live) setLoading(false) })
    }, 300)
    return () => { live = false; clearTimeout(timer) }
  }, [q])

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
      {mode === 'absent' && <Note text={t('mob.attAbsentModeNote')} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12 }}>
        <Ionicons name="search" size={18} color={p.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('mob.attSearchPh')}
          placeholderTextColor={p.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, color: p.text, fontSize: 16, fontFamily: ty.family.regular, paddingVertical: 12, paddingHorizontal: 8 }}
        />
      </View>
      {result && <ResultCard result={result} onUndo={onUndo} busy={busy} />}
      {rows === null ? (
        <Text style={{ color: p.textMuted, fontSize: 14, fontFamily: ty.family.regular, lineHeight: ty.lh(14) }}>{t('mob.attSearchHint')}</Text>
      ) : rows.length === 0 && !loading ? (
        <EmptyText>{t('mob.attSearchNone')}</EmptyText>
      ) : (
        <Card>
          {rows.map((m, i) => (
            <ListRow
              key={m.member_id}
              first={i === 0}
              icon="person-outline"
              label={m.full_name || m.society_id}
              sublabel={m.society_id}
              onPress={() => onPick(m)}
            />
          ))}
        </Card>
      )}
    </ScrollView>
  )
}

function ListTab({
  present,
  absent,
  mode,
  refreshing,
  onRefresh,
  onMark,
  onUndo,
  busy
}: {
  present: AttendanceRosterRow[]
  absent: AttendanceRosterRow[]
  mode: 'present' | 'absent'
  refreshing: boolean
  onRefresh: () => void
  onMark: (m: AttendanceRosterRow) => void
  onUndo: (memberId: number) => void
  busy: boolean
}): React.ReactElement {
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const [side, setSide] = useState<'present' | 'absent'>(mode === 'absent' ? 'absent' : 'present')
  const [q, setQ] = useState('')
  const markedSide = mode === 'absent' ? 'absent' : 'present'
  const rows = side === 'present' ? present : absent
  const term = q.trim().toLowerCase()
  const visible = term ? rows.filter((r) => (r.full_name ?? '').toLowerCase().includes(term) || r.society_id.toLowerCase().includes(term)) : rows

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      {mode === 'absent' && <Note text={t('mob.attAbsentModeNote')} />}
      <View style={{ height: mode === 'absent' ? spacing.md : 0 }} />
      <Segmented<'present' | 'absent'>
        options={[
          { value: 'present', label: `${t('mob.attPresent')} (${present.length})` },
          { value: 'absent', label: `${t('mob.attAbsent')} (${absent.length})` }
        ]}
        value={side}
        onChange={setSide}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderRadius: radius.md, borderWidth: 1, borderColor: p.border, paddingHorizontal: 12, marginVertical: spacing.md }}>
        <Ionicons name="search" size={18} color={p.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('mob.attSearchPh')}
          placeholderTextColor={p.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          style={{ flex: 1, color: p.text, fontSize: 16, fontFamily: ty.family.regular, paddingVertical: 10, paddingHorizontal: 8 }}
        />
      </View>
      {visible.length === 0 ? (
        <EmptyText>{side === 'present' ? t('mob.attEmptyPresent') : t('mob.attEmptyAbsent')}</EmptyText>
      ) : (
        <Card>
          {visible.map((r, i) => {
            const onMarkedSide = side === markedSide
            const who = r.marked_at ? `${formatTime(r.marked_at)} · ${r.mine ? t('mob.attMine') : r.marked_by_name || t('mob.attByOffice')}` : null
            return (
              <ListRow
                key={r.member_id}
                first={i === 0}
                icon={side === 'present' ? 'checkmark-circle-outline' : 'remove-circle-outline'}
                iconTone={side === 'present' ? 'success' : 'danger'}
                label={r.full_name || r.society_id}
                sublabel={who ? `${r.society_id} · ${who}` : r.society_id}
                right={
                  onMarkedSide ? (
                    r.mine ? (
                      <Pressable onPress={() => onUndo(r.member_id)} disabled={busy} accessibilityRole="button" accessibilityLabel={`${t('mob.attUndo')}: ${r.full_name ?? r.society_id}`} hitSlop={8}>
                        <Text style={{ color: p.danger, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }}>{t('mob.attUndo')}</Text>
                      </Pressable>
                    ) : undefined
                  ) : (
                    <Pressable onPress={() => onMark(r)} accessibilityRole="button" accessibilityLabel={`${t('mob.attMark')}: ${r.full_name ?? r.society_id}`} hitSlop={8}>
                      <Text style={{ color: p.primary, fontSize: 14, fontFamily: ty.family.bold, lineHeight: ty.lh(14) }}>{t('mob.attMark')}</Text>
                    </Pressable>
                  )
                }
              />
            )
          })}
        </Card>
      )}
    </Screen>
  )
}
