import React, { useMemo, useRef, useState } from 'react'
import { Alert, FlatList, KeyboardAvoidingView, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useQueryClient } from '@tanstack/react-query'
import { useT } from '../../../i18n'
import { radius, spacing, type as typeScale, usePalette } from '../../../theme'
import { useType } from '../../../typography'
import { formatDate } from '../../../lib/date'
import { uuid4 } from '../../../lib/attendance'
import { hasAudioPlayback } from '../../../lib/audioSupport'
import { commentParts, errorCode, minutesApi, minutesKeys, useMinutesComments, useMinutesReport, type MinutesComment } from '../../../api/minutes'
import { BottomSheet, Button, EmptyState, ErrorView, Input, ListRow, SegmentedTabs, SkeletonCards, useCardStyle, useToast } from '../../../ui'
import { ScalePressable } from '../../../ui/pressable'
import { MText, Pill } from '../../../ui/minutes'

type Filter = 'all' | 'open' | 'addressed'
const DELETE_WINDOW_MS = 15 * 60 * 1000

// Comments (§8.1.4): one thread across every version. Members point out
// mistakes ("page 3", "12:34" become tappable); the Secretary replies and
// marks a correction fixed in a version.
export default function MinutesComments(): React.ReactElement {
  const { id } = useLocalSearchParams<{ id: string }>()
  const reportId = Number(id)
  const { t } = useT()
  const p = usePalette()
  const ty = useType()
  const card = useCardStyle()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const toast = useToast()
  const qc = useQueryClient()
  const report = useMinutesReport(reportId)
  const comments = useMinutesComments(reportId)
  const [filter, setFilter] = useState<Filter>('all')
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<MinutesComment | null>(null)
  const [menu, setMenu] = useState<MinutesComment | null>(null)
  const [hiding, setHiding] = useState<MinutesComment | null>(null)
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)
  // One ref per message: a retried send never posts it twice
  const ref = useRef(uuid4())

  const can = report.data?.can
  const latest = report.data?.report.latest_version_no ?? null
  const pageCount = report.data?.version.page_count ?? 0
  const published = (report.data?.versions ?? []).filter((v) => v.state === 'published' && v.version_no !== null).map((v) => v.version_no as number)

  const threads = useMemo(() => {
    const items = comments.data ?? []
    return items
      .filter((c) => c.parent_id === null)
      .filter((c) => filter === 'all' || (!c.hidden && !c.deleted && c.status === filter))
      .map((c) => ({ ...c, replies: items.filter((r) => r.parent_id === c.id) }))
      .reverse()
  }, [comments.data, filter])

  const refresh = (): Promise<void> => qc.invalidateQueries({ queryKey: minutesKeys.all })

  const send = async (): Promise<void> => {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      if (replyTo && can?.publish) await minutesApi.reply(replyTo.id, body, ref.current)
      else await minutesApi.comment(reportId, { client_ref: ref.current, body, version_no: latest ?? undefined, parent_id: replyTo?.id })
      ref.current = uuid4()
      setText('')
      setReplyTo(null)
      await refresh()
    } catch (err) {
      toast.show('error', errorCode(err) === 'RATE_LIMITED' ? t('mob.mmTooMany') : t('mob.mmSendFailed'))
    } finally {
      setSending(false)
    }
  }

  const run = async (fn: () => Promise<unknown>, done: string): Promise<void> => {
    setMenu(null)
    try {
      await fn()
      await refresh()
      toast.show('success', done)
    } catch {
      toast.show('error', t('mob.errorLoad'))
    }
  }

  const onMention = (part: ReturnType<typeof commentParts>[number]): void => {
    if (part.kind === 'page') router.navigate({ pathname: '/meeting-records/[id]', params: { id: String(reportId), page: String(part.page) } })
    else if (part.kind === 'time' && !hasAudioPlayback()) toast.show('info', t('mob.mmListenNeedsUpdate'))
  }

  const renderBody = (c: MinutesComment): React.ReactElement | null => {
    if (c.deleted) return <MText size="caption" color={p.textMuted} style={{ fontStyle: 'italic' }}>{t('mob.mmCommentRemoved')}</MText>
    if (c.hidden && c.body === null) return <MText size="caption" color={p.textMuted} style={{ fontStyle: 'italic' }}>{t('mob.mmCommentHidden')}</MText>
    if (c.body === null) return null
    return (
      <MText>
        {commentParts(c.body, pageCount).map((part, i) =>
          part.kind === 'text' ? (
            <MText key={i}>{part.text}</MText>
          ) : (
            <MText key={i} weight="semibold" color={p.primaryOnSoft} style={{ backgroundColor: p.primarySoft }} onPress={() => onMention(part)} accessibilityRole="link">
              {` ${part.text} `}
            </MText>
          )
        )}
      </MText>
    )
  }

  const header = (c: MinutesComment): React.ReactElement => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
      <MText size="caption" weight="semibold">{c.deleted ? '' : c.author_name}</MText>
      {c.is_secretary ? <Pill tone="brand" text={t('mob.mmSecretary')} /> : c.is_office ? <Pill tone="neutral" text={t('mob.mmOffice')} /> : null}
      <MText size="micro" color={p.textMuted}>{formatDate(String(c.created_at).slice(0, 10))} · {t('mob.mmOnVersion', { n: c.version_no })}</MText>
    </View>
  )

  if (report.isPending || comments.isPending) return <View style={{ flex: 1, backgroundColor: p.bg, padding: spacing.lg }}><SkeletonCards cards={3} /></View>
  if (report.isError || comments.isError) return <View style={{ flex: 1, backgroundColor: p.bg, padding: spacing.lg }}><ErrorView onRetry={() => { void report.refetch(); void comments.refetch() }} /></View>

  const canDelete = (c: MinutesComment): boolean => c.is_mine && !c.deleted && Date.now() - new Date(c.created_at).getTime() < DELETE_WINDOW_MS

  return (
    // 'padding' on Android too: the view adds only the part of the keyboard
    // that actually overlaps it, so it is right whether or not Android
    // resized the window (edge-to-edge apps are not resized)
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior="padding">
      <FlatList
        data={threads}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm + 2 }}
        ListHeaderComponent={
          <SegmentedTabs<Filter>
            options={[
              { value: 'all', label: t('mob.mmFilterAll') },
              { value: 'open', label: t('mob.mmFilterOpen') },
              { value: 'addressed', label: t('mob.mmFilterFixed') }
            ]}
            value={filter}
            onChange={setFilter}
          />
        }
        ListEmptyComponent={<EmptyState icon="chatbubbles-outline" text={t('mob.mmNoComments')} />}
        renderItem={({ item: c }) => (
          <ScalePressable
            accessibilityRole="button"
            accessibilityHint={t('mob.mmCommentActionsHint')}
            onPress={() => setMenu(c)}
            scaleTo={0.99}
            style={[card, { padding: spacing.md + 2, gap: spacing.sm }]}
          >
            {header(c)}
            {renderBody(c)}
            {!c.deleted && !c.hidden ? (
              c.status === 'addressed'
                ? <Pill tone="success" text={t('mob.mmFixedIn', { n: c.addressed_in_version_no ?? '' })} />
                : <Pill tone="warning" text={t('mob.mmOpen')} />
            ) : null}
            {c.replies.map((r) => (
              <View key={r.id} style={{ marginLeft: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: p.surfaceAlt, gap: spacing.xs }}>
                {header(r)}
                {renderBody(r)}
              </View>
            ))}
          </ScalePressable>
        )}
      />

      {/* Clear of Android's navigation buttons (the app draws edge to edge) */}
      <View style={{ padding: spacing.md, paddingBottom: Math.max(insets.bottom, spacing.md), borderTopWidth: 1, borderTopColor: p.border, backgroundColor: p.surface, gap: spacing.xs }}>
        {replyTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MText size="caption" color={p.textMuted} style={{ flex: 1 }}>{t('mob.mmReplyingTo', { name: replyTo.author_name ?? '' })}</MText>
            <ScalePressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => setReplyTo(null)} style={{ minWidth: 48, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={p.textMuted} />
            </ScalePressable>
          </View>
        ) : (
          <MText size="micro" color={p.textMuted}>{t('mob.mmCommentHint')}</MText>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('mob.mmWriteCorrection')}
            placeholderTextColor={p.textSubtle}
            multiline
            maxLength={1000}
            accessibilityLabel={t('mob.mmWriteCorrection')}
            style={{ flex: 1, minHeight: 48, maxHeight: 140, borderWidth: 1.5, borderColor: p.borderStrong, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: p.text, backgroundColor: p.surface, fontSize: typeScale.body, fontFamily: ty.family.regular }}
          />
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel={t('mob.mmSend')}
            accessibilityState={{ disabled: !text.trim() || sending }}
            disabled={!text.trim() || sending}
            haptic="selection"
            onPress={() => void send()}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center', opacity: !text.trim() || sending ? 0.5 : 1 }}
          >
            <Ionicons name="send" size={20} color={p.onPrimary} />
          </ScalePressable>
        </View>
        {text.length > 900 ? <MText size="micro" color={p.textMuted}>{t('mob.mmCharsLeft', { n: 1000 - text.length })}</MText> : null}
      </View>

      <BottomSheet visible={menu !== null} onClose={() => setMenu(null)} title={t('mob.mmCommentActions')}>
        {menu ? (
          <View style={{ gap: 0 }}>
            {(can?.publish || menu.is_mine) && !menu.deleted ? (
              <ListRow first icon="arrow-undo-outline" label={t('mob.mmReply')} onPress={() => { setReplyTo(menu); setMenu(null) }} />
            ) : null}
            {can?.publish && menu.status === 'open' && !menu.deleted
              ? published.filter((n) => n >= menu.version_no).map((n) => (
                <ListRow key={n} icon="checkmark-circle-outline" iconTone="success" label={t('mob.mmMarkFixedIn', { n })} onPress={() => void run(() => minutesApi.addressed(menu.id, n), t('mob.mmMarkedFixed', { n }))} />
              ))
              : null}
            {can?.publish && menu.status === 'addressed' ? (
              <ListRow icon="refresh-outline" label={t('mob.mmReopen')} onPress={() => void run(() => minutesApi.reopen(menu.id), t('mob.mmReopened'))} />
            ) : null}
            {can?.moderate && !menu.hidden && !menu.deleted ? (
              <ListRow icon="eye-off-outline" iconTone="danger" label={t('mob.mmHide')} onPress={() => { setHiding(menu); setReason(''); setMenu(null) }} />
            ) : null}
            {canDelete(menu) ? (
              <ListRow icon="trash-outline" iconTone="danger" label={t('mob.mmRemoveMine')} onPress={() => void run(() => minutesApi.removeOwn(menu.id), t('mob.mmRemoved'))} />
            ) : null}
            {!menu.is_mine && !menu.deleted && !can?.moderate ? (
              <ListRow
                icon="flag-outline"
                iconTone="danger"
                label={t('mob.mmReportComment')}
                onPress={() => {
                  const target = menu
                  setMenu(null)
                  Alert.alert(t('mob.mmReportComment'), t('mob.mmReportCommentBody'), [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('mob.mmReportSend'), style: 'destructive', onPress: () => void run(() => minutesApi.report(target.id), t('mob.mmReported')) }
                  ])
                }}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={hiding !== null}
        onClose={() => setHiding(null)}
        title={t('mob.mmHideTitle')}
        footer={<Button label={t('mob.mmHide')} variant="danger" disabled={!reason.trim()} onPress={() => { const c = hiding; setHiding(null); if (c) void run(() => minutesApi.hide(c.id, reason.trim()), t('mob.mmHidden')) }} />}
      >
        <MText size="caption" color={p.textMuted} style={{ marginBottom: spacing.md }}>{t('mob.mmHideBody')}</MText>
        <Input label={t('mob.mmReason')} value={reason} onChangeText={setReason} maxLength={300} />
      </BottomSheet>
    </KeyboardAvoidingView>
  )
}
