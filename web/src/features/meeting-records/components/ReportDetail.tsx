import { useState } from 'react'
import { ArrowLeft, Download, ExternalLink, FilePenLine, Headphones, History, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage, isApiError } from '@/lib/api/errors'
import { formatDate, formatDateTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { meetingRecordsApi } from '../api'
import { useInvalidateRecords, useMeetingRecord } from '../queries'
import { formatBytes, formatDuration } from '../types'
import { CommentsPanel } from './CommentsPanel'
import { PageViewer } from './PageViewer'

// The desktop shell keeps every window inside the app and refuses new ones,
// so there a PDF is downloaded rather than opened in a tab
const inShell = typeof navigator !== 'undefined' && /eSamithiShell/i.test(navigator.userAgent)

export function ReportDetail({ id, versionNo, onBack, onVersion, onEditDraft }: { id: number; versionNo?: number; onBack: () => void; onVersion: (n: number | undefined) => void; onEditDraft: (id: number) => void }) {
  const { t, lang } = useT()
  const record = useMeetingRecord(id, versionNo)
  const invalidate = useInvalidateRecords()
  const [withdrawing, setWithdrawing] = useState(false)
  const [reason, setReason] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const back = (
    <Button variant="ghost" size="sm" onClick={onBack} className="mb-3">
      <ArrowLeft /> {t('mm.title')}
    </Button>
  )

  if (record.isPending) {
    return (
      <div>
        {back}
        <Skeleton className="h-[480px] w-full" />
      </div>
    )
  }
  if (record.isError || !record.data) {
    const withdrawn = isApiError(record.error) && record.error.code === 'VERSION_WITHDRAWN'
    return (
      <div>
        {back}
        <EmptyState
          title={withdrawn ? t('mm.versionWithdrawn') : t('mm.loadFailed')}
          action={<Button variant="secondary" onClick={() => void record.refetch()}>{t('common.retry')}</Button>}
        />
      </div>
    )
  }

  const { version: v, versions, report, can } = record.data
  const label = t('mm.versionN', { n: v.version_no ?? '—' })
  const isLatest = v.version_no === report.latest_version_no

  const startRevision = async () => {
    try {
      setBusy(true)
      if (!report.has_draft) await meetingRecordsApi.startRevision(id)
      await invalidate()
      onEditDraft(id)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    if (v.version_no === null) return
    try {
      setBusy(true)
      await meetingRecordsApi.withdraw(id, v.version_no, reason.trim())
      toast.success(t('mm.withdrawn', { n: v.version_no }))
      setWithdrawing(false)
      await invalidate()
      onVersion(undefined)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    if (v.version_no === null) return
    try {
      setBusy(true)
      await meetingRecordsApi.restore(id, v.version_no)
      toast.success(t('mm.restored', { n: v.version_no }))
      await invalidate()
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        {back}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{v.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('mm.meetingOn', { date: formatDate(v.meeting_date, lang) })} · {label} · {t('mm.publishedOn', { date: formatDateTime(v.published_at, lang) })}
            </p>
            <p className="text-sm text-muted-foreground">
              {v.author_position === 'office' ? t('mm.byOffice', { name: v.author_name ?? '—' }) : t('mm.bySecretary', { name: v.author_name ?? '—' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {v.pdf_url && !inShell && (
              <Button variant="secondary" asChild>
                <a href={v.pdf_url} target="_blank" rel="noopener">
                  <ExternalLink /> {t('mm.openPdf')}
                </a>
              </Button>
            )}
            {v.pdf_url && (
              <Button variant="secondary" asChild>
                <a href={v.pdf_url} download>
                  <Download /> {t('mm.downloadPdf')} <span className="text-muted-foreground">{formatBytes(v.pdf_bytes)}</span>
                </a>
              </Button>
            )}
            {can.publish && isLatest && v.state === 'published' && (
              <Button onClick={() => void startRevision()} loading={busy}>
                <FilePenLine /> {report.has_draft ? t('mm.continueRevision') : t('mm.startRevision')}
              </Button>
            )}
          </div>
        </div>
      </div>

      {v.state === 'withdrawn' && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          <span className="font-medium">{t('mm.withdrawnBanner', { date: formatDateTime(v.withdrawn_at, lang), reason: v.withdrawn_reason ?? '' })}</span>
          {can.withdraw && (
            <Button size="sm" variant="secondary" onClick={() => void restore()} loading={busy}>
              <Undo2 /> {t('mm.restore')}
            </Button>
          )}
        </div>
      )}
      {v.state === 'published' && !isLatest && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-accent px-4 py-3 text-sm">
          <span>{t('mm.olderVersion', { n: v.version_no ?? '—' })}</span>
          <Button size="sm" variant="secondary" onClick={() => onVersion(undefined)}>{t('mm.openLatest')}</Button>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-[999_1_520px]">
          <CardContent>
            <PageViewer pages={v.pages} />
          </CardContent>
        </Card>

        <div className="grid min-w-0 flex-[1_1_340px] gap-4">
          <Card>
            <CardContent className="grid gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Headphones className="size-4 text-primary" /> {t('mm.recording')}
              </h2>
              {v.audio_url ? (
                <>
                  <audio controls preload="metadata" src={v.audio_url} className="w-full" aria-label={t('mm.recording')} />
                  <p className="text-xs text-muted-foreground">{formatDuration(v.audio_ms)} · {formatBytes(v.audio_bytes)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t('mm.noRecording')}</p>
              )}
              {v.change_summary && (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
                  <span className="font-medium">{t('mm.whatChanged')}:</span> {v.change_summary}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <History className="size-4 text-primary" /> {t('mm.versions')}
              </h2>
              <ul className="grid gap-1">
                {versions.map((x) => (
                  <li key={x.version_no ?? 'd'}>
                    <button
                      type="button"
                      onClick={() => onVersion(x.version_no === report.latest_version_no ? undefined : x.version_no ?? undefined)}
                      aria-current={x.version_no === v.version_no ? 'true' : undefined}
                      className={cn('grid w-full gap-0.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent', x.version_no === v.version_no && 'bg-accent')}
                    >
                      <span className="flex flex-wrap items-center gap-2 font-medium">
                        {t('mm.versionN', { n: x.version_no ?? '—' })}
                        {x.version_no === report.latest_version_no && <Badge variant="brand">{t('mm.latest')}</Badge>}
                        {x.state === 'withdrawn' && <Badge variant="danger">{t('mm.withdrawnBadge')}</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(x.published_at, lang)} · {x.author_name ?? '—'}
                      </span>
                      {x.change_summary && <span className="text-xs">{x.change_summary}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {can.withdraw && v.state === 'published' && (
                <Button size="sm" variant="ghost" className="justify-self-start text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { setWithdrawing(true); setReason(''); setTyped('') }}>
                  {t('mm.withdrawVersion', { n: v.version_no ?? '—' })}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <CommentsPanel reportId={id} can={can} versions={versions} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={withdrawing} onOpenChange={(o) => !busy && setWithdrawing(o)}>
        <DialogContent className="sm:max-w-md">
          <form className="contents" onSubmit={(e) => { e.preventDefault(); void withdraw() }}>
            <DialogHeader>
              <DialogTitle>{t('mm.withdrawTitle', { n: v.version_no ?? '—' })}</DialogTitle>
              <DialogDescription>{t('mm.withdrawBody')}</DialogDescription>
            </DialogHeader>
            <Textarea aria-label={t('mm.reason')} placeholder={t('mm.reason')} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            <label className="grid gap-1 text-sm">
              <span>{t('mm.typeToConfirm', { text: label })}</span>
              <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setWithdrawing(false)} disabled={busy}>{t('common.cancel')}</Button>
              <Button type="submit" variant="destructive" loading={busy} disabled={!reason.trim() || typed.trim() !== label}>{t('mm.withdraw')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
