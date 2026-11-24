import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { ArrowLeft, ChevronLeft, ChevronRight, FileAudio, FileText, ImagePlus, RefreshCw, RotateCw, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Field } from '@/components/form/Field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api/errors'
import { todayIso } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { meetingRecordsApi, preparePhoto, uploadAudio } from '../api'
import { useDraft, useInvalidateRecords, useSetDraft } from '../queries'
import { formatBytes, formatDuration, type DraftView } from '../types'

interface QueuedPage {
  key: string
  file: File
  clientRef: string
  replacePageId?: number
  status: 'waiting' | 'uploading' | 'failed'
  error?: string
}

// Best effort: a browser that can play the file tells us its length. The
// app's recordings always carry it; an office upload may not (null is fine).
function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file)
      const el = new Audio()
      const done = (v: number | null) => {
        URL.revokeObjectURL(url)
        resolve(v)
      }
      const timer = setTimeout(() => done(null), 4000)
      el.preload = 'metadata'
      el.onloadedmetadata = () => {
        clearTimeout(timer)
        done(Number.isFinite(el.duration) ? Math.round(el.duration * 1000) : null)
      }
      el.onerror = () => {
        clearTimeout(timer)
        done(null)
      }
      el.src = url
    } catch {
      resolve(null)
    }
  })
}

// Prepare and publish from the PC (§8.3.4, D2): the same steps as the phone,
// with audio uploaded from a file (browsers here cannot record).
export function DraftEditor({ id, onBack, onPublished, onDiscarded }: { id: number; onBack: () => void; onPublished: (id: number) => void; onDiscarded: () => void }) {
  const { t } = useT()
  const draft = useDraft(id)
  const setDraft = useSetDraft()
  const invalidate = useInvalidateRecords()

  const [details, setDetails] = useState({ title: '', meeting_date: '', change_summary: '' })
  const [queue, setQueue] = useState<QueuedPage[]>([])
  const [audio, setAudio] = useState<{ file: File; uploadId: string; sent: number; total: number; status: 'uploading' | 'failed'; error?: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [removing, setRemoving] = useState<number | null>(null)
  const [notify, setNotify] = useState(false)
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropActive, setDropActive] = useState(false)
  const publishRef = useRef(crypto.randomUUID())
  const running = useRef(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<number | null>(null)
  const audioInput = useRef<HTMLInputElement>(null)

  const d = draft.data
  useEffect(() => {
    if (d) setDetails({ title: d.title, meeting_date: d.meeting_date, change_summary: d.change_summary ?? '' })
    // Only when another draft loads; edits in progress are not overwritten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.report_id])

  const apply = useCallback((next: DraftView) => setDraft(next), [setDraft])

  // Pages upload one at a time, in the order chosen; a failure waits for Retry
  useEffect(() => {
    if (running.current) return
    const next = queue.find((q) => q.status === 'waiting')
    if (!next) return
    running.current = true
    setQueue((qs) => qs.map((q) => (q.key === next.key ? { ...q, status: 'uploading' } : q)))
    void (async () => {
      try {
        const photo = await preparePhoto(next.file)
        const view = await meetingRecordsApi.addPage(id, { clientRef: next.clientRef, photo, replacePageId: next.replacePageId })
        apply(view)
        setQueue((qs) => qs.filter((q) => q.key !== next.key))
      } catch (err) {
        setQueue((qs) => qs.map((q) => (q.key === next.key ? { ...q, status: 'failed', error: errorMessage(err) } : q)))
      } finally {
        running.current = false
        // Wake the effect for the next waiting page
        setQueue((qs) => [...qs])
      }
    })()
  }, [queue, id, apply])

  const addFiles = (files: FileList | File[] | null, replacePageId?: number) => {
    if (!files) return
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    setQueue((qs) => [...qs, ...list.map((file) => ({ key: crypto.randomUUID(), file, clientRef: crypto.randomUUID(), replacePageId, status: 'waiting' as const }))])
  }

  const act = async (label: string, fn: () => Promise<DraftView | void>) => {
    setBusy(label)
    try {
      const view = await fn()
      if (view) apply(view)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const saveDetails = (field: 'title' | 'meeting_date' | 'change_summary') => {
    if (!d) return
    const value = details[field].trim()
    const current = field === 'change_summary' ? d.change_summary ?? '' : d[field]
    if (value === current) return
    if (field !== 'change_summary' && !value) return
    void act('details', () => meetingRecordsApi.updateDraft(id, { [field]: field === 'change_summary' ? value || null : value }))
  }

  const move = (from: number, to: number) => {
    if (!d || to < 0 || to >= d.pages.length || from === to) return
    const ids = d.pages.map((p) => p.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    void act('order', () => meetingRecordsApi.reorder(id, ids))
  }

  const onDrop = (e: DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!d || dragId === null) return
    move(d.pages.findIndex((p) => p.id === dragId), targetIndex)
    setDragId(null)
  }

  const startAudio = async (file: File, uploadId: string = crypto.randomUUID()) => {
    setAudio({ file, uploadId, sent: 0, total: file.size, status: 'uploading' })
    try {
      const view = await uploadAudio(id, file, uploadId, await audioDuration(file), (sent, total) => setAudio((a) => (a ? { ...a, sent, total } : a)))
      apply(view)
      setAudio(null)
      toast.success(t('mm.recordingUploaded'))
    } catch (err) {
      setAudio((a) => (a ? { ...a, status: 'failed', error: errorMessage(err) } : a))
    }
  }

  if (draft.isPending) return <Skeleton className="h-[480px] w-full" />
  if (draft.isError || !d) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3"><ArrowLeft /> {t('mm.title')}</Button>
        <EmptyState title={t('mm.draftLoadFailed')} description={errorMessage(draft.error)} action={<Button variant="secondary" onClick={() => void draft.refetch()}>{t('common.retry')}</Button>} />
      </div>
    )
  }

  const uploading = queue.some((q) => q.status !== 'failed') || audio?.status === 'uploading' || d.audio_uploads.length > 0
  const ready = d.page_count > 0 && details.title.trim() !== '' && details.meeting_date !== '' && !uploading && (!d.is_revision || details.change_summary.trim() !== '')

  const publish = async () => {
    setBusy('publish')
    try {
      if (d.is_revision && details.change_summary.trim() !== (d.change_summary ?? '')) {
        await meetingRecordsApi.updateDraft(id, { change_summary: details.change_summary.trim() })
      }
      const r = await meetingRecordsApi.publish(id, { publish_ref: publishRef.current, change_summary: d.is_revision ? details.change_summary.trim() : undefined, notify: d.is_revision ? notify : undefined })
      toast.success(t('mm.publishedToast', { n: r.version_no }))
      setConfirmPublish(false)
      await invalidate()
      onPublished(id)
    } catch (err) {
      // The same publish_ref is kept: trying again can never publish twice
      toast.error(errorMessage(err, t('mm.publishRetry')))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-3"><ArrowLeft /> {t('mm.title')}</Button>
        <h1 className="text-2xl font-semibold tracking-tight">{d.is_revision ? t('mm.updateTitle', { n: d.next_version_no }) : t('mm.newMinutes')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('mm.officeAuthorNote')}</p>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-[999_1_520px] gap-4">
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-[2fr_1fr]">
              <Field label={t('mm.reportTitle')} required>
                {({ id: fid }) => <Input id={fid} value={details.title} maxLength={200} onChange={(e) => setDetails({ ...details, title: e.target.value })} onBlur={() => saveDetails('title')} />}
              </Field>
              <Field label={t('mm.meetingDate')} required>
                {({ id: fid }) => <Input id={fid} type="date" max={todayIso()} value={details.meeting_date} onChange={(e) => setDetails({ ...details, meeting_date: e.target.value })} onBlur={() => saveDetails('meeting_date')} />}
              </Field>
              {d.is_revision && (
                <Field label={t('mm.whatChanged')} required className="sm:col-span-2" description={t('mm.whatChangedHint')}>
                  {({ id: fid, describedBy }) => <Textarea id={fid} aria-describedby={describedBy} value={details.change_summary} maxLength={500} onChange={(e) => setDetails({ ...details, change_summary: e.target.value })} onBlur={() => saveDetails('change_summary')} />}
                </Field>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">{t('mm.pagesCount', { n: d.page_count })}</CardTitle>
              <span className="text-xs text-muted-foreground">{t('mm.reorderHint')}</span>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div
                onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDropActive(true) } }}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDropActive(false); addFiles(e.dataTransfer.files) } }}
                className={cn('grid place-items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center', dropActive ? 'border-primary bg-accent' : 'border-border bg-muted/40')}
              >
                <ImagePlus className="size-6 text-primary" />
                <p className="text-sm font-medium">{t('mm.dropPhotos')}</p>
                <p className="text-xs text-muted-foreground">{t('mm.photoLimits', { n: d.max_pages })}</p>
                <Button size="sm" variant="secondary" onClick={() => fileInput.current?.click()} disabled={d.page_count >= d.max_pages}>
                  <Upload /> {t('mm.chooseImages')}
                </Button>
                <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
                <input ref={replaceInput} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { if (replaceTarget.current) addFiles(e.target.files, replaceTarget.current); replaceTarget.current = null; e.target.value = '' }} />
              </div>

              {queue.length > 0 && (
                <ul className="grid gap-1 text-sm" aria-live="polite">
                  {queue.map((q) => (
                    <li key={q.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5">
                      <span className="min-w-0 truncate">{q.file.name}</span>
                      {q.status === 'failed' ? (
                        <span className="flex items-center gap-2 text-danger">
                          {q.error}
                          <Button size="sm" variant="secondary" onClick={() => setQueue((qs) => qs.map((x) => (x.key === q.key ? { ...x, status: 'waiting' } : x)))}>{t('common.retry')}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setQueue((qs) => qs.filter((x) => x.key !== q.key))}>{t('common.cancel')}</Button>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{q.status === 'uploading' ? t('mm.uploading') : t('mm.waiting')}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {d.pages.length > 0 && (
                <ol className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3">
                  {d.pages.map((p, i) => (
                    <li
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => { if (dragId !== null) e.preventDefault() }}
                      onDrop={(e) => onDrop(e, i)}
                      className={cn('grid gap-2 rounded-lg border bg-card p-2', dragId === p.id ? 'border-primary opacity-60' : 'border-border')}
                    >
                      <div className="relative h-36 overflow-hidden rounded bg-white">
                        <img src={p.thumb_url} alt={t('mm.pageOf', { n: i + 1, total: d.pages.length })} className="h-full w-full object-contain" />
                        <span className="tnum absolute top-1 left-1 grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{i + 1}</span>
                      </div>
                      <div className="flex justify-between gap-1">
                        <Button size="icon-sm" variant="ghost" aria-label={t('mm.moveEarlier', { n: i + 1 })} disabled={i === 0 || busy !== null} onClick={() => move(i, i - 1)}><ChevronLeft /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t('mm.rotatePage', { n: i + 1 })} disabled={busy !== null} onClick={() => void act('rotate', () => meetingRecordsApi.rotate(id, p.id, 90))}><RotateCw /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t('mm.replacePage', { n: i + 1 })} disabled={busy !== null} onClick={() => { replaceTarget.current = p.id; replaceInput.current?.click() }}><RefreshCw /></Button>
                        <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={t('mm.removePage', { n: i + 1 })} disabled={busy !== null} onClick={() => setRemoving(p.id)}><Trash2 /></Button>
                        <Button size="icon-sm" variant="ghost" aria-label={t('mm.moveLater', { n: i + 1 })} disabled={i === d.pages.length - 1 || busy !== null} onClick={() => move(i, i + 1)}><ChevronRight /></Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('mm.recording')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">{t('mm.audioHint')}</p>
              {d.audio_url && !audio && (
                <div className="grid gap-2">
                  <audio controls preload="metadata" src={d.audio_url} className="w-full" aria-label={t('mm.recording')} />
                  <p className="text-xs text-muted-foreground">{formatDuration(d.audio_ms)} · {formatBytes(d.audio_bytes)}</p>
                </div>
              )}
              {audio && (
                <div className="grid gap-1.5" aria-live="polite">
                  <div className="flex justify-between text-sm">
                    <span className="min-w-0 truncate font-medium">{audio.file.name}</span>
                    <span className="tnum text-muted-foreground">{formatBytes(audio.sent)} / {formatBytes(audio.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((audio.sent / Math.max(1, audio.total)) * 100)} aria-label={t('mm.uploading')}>
                    <div className="h-2 bg-primary transition-[width]" style={{ width: `${(audio.sent / Math.max(1, audio.total)) * 100}%` }} />
                  </div>
                  {audio.status === 'failed' && (
                    <div className="flex flex-wrap items-center gap-2 text-sm text-danger">
                      {audio.error}
                      <Button size="sm" variant="secondary" onClick={() => void startAudio(audio.file, audio.uploadId)}>{t('mm.resumeUpload')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAudio(null)}>{t('common.cancel')}</Button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={audio?.status === 'uploading'} onClick={() => audioInput.current?.click()}>
                  <FileAudio /> {d.audio_url ? t('mm.replaceRecording') : t('mm.uploadRecording')}
                </Button>
                {(d.audio_url || d.audio_uploads.length > 0) && !audio && (
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" loading={busy === 'audio'} onClick={() => void act('audio', () => meetingRecordsApi.removeAudio(id))}>
                    <Trash2 /> {t('mm.removeRecording')}
                  </Button>
                )}
                <input ref={audioInput} type="file" accept="audio/*,.m4a,.mp3,.aac,.wav,.ogg" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void startAudio(f); e.target.value = '' }} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 flex-[1_1_300px] lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle className="text-base">{t('mm.readyTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="grid gap-1.5 text-sm">
              <Check ok={details.title.trim() !== '' && details.meeting_date !== ''} text={t('mm.checkDetails')} />
              <Check ok={d.page_count > 0 && !queue.some((q) => q.status !== 'failed')} text={t('mm.checkPages', { n: d.page_count })} />
              <Check ok={!(audio?.status === 'uploading' || d.audio_uploads.length > 0)} text={d.audio_url ? t('mm.checkAudio') : t('mm.checkNoAudio')} />
              {d.is_revision && <Check ok={details.change_summary.trim() !== ''} text={t('mm.checkSummary')} />}
            </ul>
            <Button variant="secondary" loading={busy === 'pdf'} disabled={d.page_count === 0 || queue.length > 0} onClick={() => void act('pdf', async () => {
              const r = await meetingRecordsApi.previewPdf(id)
              const a = document.createElement('a')
              a.href = r.pdf_url
              a.download = ''
              a.click()
              await draft.refetch()
            })}>
              <FileText /> {t('mm.previewPdf')}
            </Button>
            {d.is_revision ? (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                <span className="grid gap-0.5">
                  <span className="font-medium">{t('mm.notifyMembers')}</span>
                  <span className="text-muted-foreground">{t('mm.notifyHint')}</span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">{t('mm.firstPublishNotifies')}</p>
            )}
            <Button disabled={!ready} loading={busy === 'publish'} onClick={() => setConfirmPublish(true)}>
              {d.is_revision ? t('mm.publishVersion', { n: d.next_version_no }) : t('mm.publish')}
            </Button>
            <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmDiscard(true)}>
              {t('mm.discardDraft')}
            </Button>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title={d.is_revision ? t('mm.publishVersion', { n: d.next_version_no }) : t('mm.publishTitle')}
        description={d.is_revision ? (notify ? t('mm.publishRevisionNotify') : t('mm.publishRevisionQuiet')) : t('mm.publishFirst')}
        confirmLabel={t('mm.publish')}
        busy={busy === 'publish'}
        onConfirm={publish}
      />
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        danger
        title={t('mm.discardDraft')}
        description={d.is_revision ? t('mm.discardRevisionBody') : t('mm.discardBody')}
        confirmLabel={t('mm.discard')}
        busy={busy === 'discard'}
        onConfirm={async () => {
          setBusy('discard')
          try {
            await meetingRecordsApi.discardDraft(id)
            setConfirmDiscard(false)
            await invalidate()
            onDiscarded()
          } catch (err) {
            toast.error(errorMessage(err))
          } finally {
            setBusy(null)
          }
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(o) => !o && setRemoving(null)}
        danger
        title={t('mm.removePageTitle')}
        confirmLabel={t('common.delete')}
        busy={busy === 'remove'}
        onConfirm={async () => {
          const pid = removing
          setRemoving(null)
          if (pid) await act('remove', () => meetingRecordsApi.removePage(id, pid))
        }}
      />
    </div>
  )
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-2">
      <Badge variant={ok ? 'success' : 'neutral'} className="min-w-6 justify-center">{ok ? '✓' : '…'}</Badge>
      <span className={ok ? '' : 'text-muted-foreground'}>{text}</span>
    </li>
  )
}
