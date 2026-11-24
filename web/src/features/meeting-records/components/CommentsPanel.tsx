import { useMemo, useState } from 'react'
import { CheckCircle2, EyeOff, MessageSquare, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { formatDateTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { meetingRecordsApi } from '../api'
import { useCommentAction, useMinutesComments } from '../queries'
import { threads, type Can, type MinutesComment, type VersionSummary } from '../types'

type Filter = 'all' | 'open' | 'addressed' | 'hidden'

// Members' correction comments (§8.3.3): one thread across every version.
// Publishers reply and mark a correction addressed in a version; staff hide
// a comment that should not be there.
export function CommentsPanel({ reportId, can, versions }: { reportId: number; can: Can; versions: VersionSummary[] }) {
  const { t, lang } = useT()
  const comments = useMinutesComments(reportId)
  const action = useCommentAction()
  const [filter, setFilter] = useState<Filter>('all')
  const [replying, setReplying] = useState<number | null>(null)
  const [reply, setReply] = useState('')
  const [hiding, setHiding] = useState<MinutesComment | null>(null)
  const [reason, setReason] = useState('')

  const published = versions.filter((v) => v.state === 'published' && v.version_no !== null).map((v) => v.version_no as number)
  const all = useMemo(() => threads(comments.data?.items ?? []), [comments.data])
  const shown = all.filter((c) =>
    filter === 'all' ? true : filter === 'hidden' ? c.hidden : !c.hidden && !c.deleted && c.status === filter
  )
  const count = (f: Filter) => all.filter((c) => (f === 'all' ? true : f === 'hidden' ? c.hidden : !c.hidden && !c.deleted && c.status === f)).length

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await action.mutateAsync(fn)
      toast.success(done)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }

  const author = (c: MinutesComment) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold">{c.deleted ? t('mm.commentRemoved') : c.author_name}</span>
      {c.is_secretary && <Badge variant="brand">{t('settings.positionSecretary')}</Badge>}
      {c.is_office && <Badge variant="neutral">{t('mm.office')}</Badge>}
      <span className="text-xs text-muted-foreground">
        {formatDateTime(c.created_at, lang)} · {t('mm.onVersion', { n: c.version_no })}
      </span>
    </span>
  )

  return (
    <section aria-labelledby="mm-comments" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mm-comments" className="flex items-center gap-2 text-base font-semibold">
          <MessageSquare className="size-4 text-primary" /> {t('mm.comments')}
        </h2>
        <NativeSelect aria-label={t('mm.filterComments')} value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-auto">
          <option value="all">{t('mm.filterAll', { n: count('all') })}</option>
          <option value="open">{t('mm.filterOpen', { n: count('open') })}</option>
          <option value="addressed">{t('mm.filterAddressed', { n: count('addressed') })}</option>
          {can.moderate && <option value="hidden">{t('mm.filterHidden', { n: count('hidden') })}</option>}
        </NativeSelect>
      </div>

      {comments.isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t('mm.noComments')}</p>
      ) : (
        <ul className="grid gap-3">
          {shown.map((c) => (
            <li key={c.id} className="grid gap-2 rounded-lg border border-border bg-card p-3 text-sm">
              {author(c)}
              {c.hidden && <p className="text-xs font-medium text-muted-foreground">{t('mm.hiddenBy', { name: c.hidden_by_name ?? '—', reason: c.hidden_reason ?? '' })}</p>}
              {c.body !== null && <p className="whitespace-pre-line">{c.body}</p>}
              {!c.deleted && (
                <div className="flex flex-wrap items-center gap-2">
                  {c.status === 'addressed' ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 /> {t('mm.fixedIn', { n: c.addressed_in_version_no ?? '—' })}
                    </Badge>
                  ) : (
                    <Badge variant="warning">{t('mm.open')}</Badge>
                  )}
                </div>
              )}
              {c.replies.length > 0 && (
                <ul className="grid gap-2 border-l-2 border-border pl-3">
                  {c.replies.map((r) => (
                    <li key={r.id} className="grid gap-1">
                      {author(r)}
                      {r.body !== null && <p className="whitespace-pre-line">{r.body}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {!c.deleted && (can.publish || can.moderate) && (
                <div className="flex flex-wrap items-center gap-2">
                  {can.publish && (
                    <Button size="sm" variant="secondary" onClick={() => { setReplying(replying === c.id ? null : c.id); setReply('') }}>
                      {t('mm.reply')}
                    </Button>
                  )}
                  {can.publish && c.status === 'open' && published.filter((n) => n >= c.version_no).length > 0 && (
                    <NativeSelect
                      aria-label={t('mm.markAddressedIn')}
                      value=""
                      className="h-8 w-auto text-[13px]"
                      onChange={(e) => {
                        const n = Number(e.target.value)
                        if (n) void run(() => meetingRecordsApi.addressed(c.id, n), t('mm.markedAddressed', { n }))
                      }}
                    >
                      <option value="">{t('mm.markAddressedIn')}</option>
                      {published.filter((n) => n >= c.version_no).map((n) => (
                        <option key={n} value={n}>{t('mm.versionN', { n })}</option>
                      ))}
                    </NativeSelect>
                  )}
                  {can.publish && c.status === 'addressed' && (
                    <Button size="sm" variant="ghost" onClick={() => void run(() => meetingRecordsApi.reopen(c.id), t('mm.reopened'))}>
                      <RotateCcw /> {t('mm.reopen')}
                    </Button>
                  )}
                  {can.moderate && !c.hidden && (
                    <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { setHiding(c); setReason('') }}>
                      <EyeOff /> {t('mm.hide')}
                    </Button>
                  )}
                  {can.moderate && c.hidden && (
                    <Button size="sm" variant="ghost" onClick={() => void run(() => meetingRecordsApi.unhide(c.id), t('mm.unhidden'))}>
                      {t('mm.unhide')}
                    </Button>
                  )}
                </div>
              )}
              {replying === c.id && (
                <form
                  className="grid gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    if (!reply.trim()) return
                    if (await run(() => meetingRecordsApi.reply(c.id, reply.trim()), t('mm.replied'))) setReplying(null)
                  }}
                >
                  <Textarea aria-label={t('mm.reply')} value={reply} maxLength={1000} onChange={(e) => setReply(e.target.value)} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setReplying(null)}>{t('common.cancel')}</Button>
                    <Button type="submit" size="sm" loading={action.isPending} disabled={!reply.trim()}>{t('mm.sendReply')}</Button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog open={hiding !== null} onOpenChange={(o) => !o && setHiding(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            className="contents"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!hiding || !reason.trim()) return
              if (await run(() => meetingRecordsApi.hide(hiding.id, reason.trim()), t('mm.hidden'))) setHiding(null)
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('mm.hideTitle')}</DialogTitle>
              <DialogDescription>{t('mm.hideBody')}</DialogDescription>
            </DialogHeader>
            <Textarea aria-label={t('mm.reason')} placeholder={t('mm.reason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHiding(null)}>{t('common.cancel')}</Button>
              <Button type="submit" variant="destructive" loading={action.isPending} disabled={!reason.trim()}>{t('mm.hide')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
