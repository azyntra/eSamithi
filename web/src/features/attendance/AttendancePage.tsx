import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck, Download, ScanLine, Users } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { errorMessage } from '@/lib/api/errors'
import { downloadCsv, toCsv } from '@/lib/format/csv'
import { formatDate, formatTime } from '@/lib/format/dates'
import { formatNumber } from '@/lib/format/currency'
import { useT } from '@/lib/i18n'
import { CreateEventDialog } from './components/CreateEventDialog'
import { EventList } from './components/EventList'
import { RosterTable } from './components/RosterTable'
import { ScanPanel } from './components/ScanPanel'
import { useDeleteEvent, useEventDetail, useEvents, useMarkMember, useSetMode, useUnmarkMember } from './queries'
import { turnoutPct, type AttendanceMode, type AttendanceRow, type SocietyEvent } from './types'

interface Props {
  eventId: number | null
  view: AttendanceMode
  search: string
  onNavigate: (next: { event?: number | null; view?: AttendanceMode; q?: string }) => void
}

export function AttendancePage({ eventId, view, search, onNavigate }: Props) {
  const { t, lang } = useT()
  const events = useEvents()
  const detail = useEventDetail(eventId)
  const setMode = useSetMode(eventId)
  const markMember = useMarkMember(eventId)
  const unmarkMember = useUnmarkMember(eventId)
  const deleteEvent = useDeleteEvent()

  const [showCreate, setShowCreate] = useState(false)
  const [pendingMode, setPendingMode] = useState<AttendanceMode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SocietyEvent | null>(null)
  const [busyMember, setBusyMember] = useState<number | null>(null)

  // Land on the newest event so a counter that opens the page can start
  // scanning without picking anything first.
  const firstId = events.data?.[0]?.id ?? null
  useEffect(() => {
    if (eventId === null && firstId !== null) onNavigate({ event: firstId })
  }, [eventId, firstId, onNavigate])

  const mode: AttendanceMode = detail.data?.event.attendance_mode === 'absent' ? 'absent' : 'present'
  const present = detail.data?.present ?? []
  const absent = detail.data?.absent ?? []
  const total = present.length + absent.length
  const turnout = turnoutPct(present.length, total)
  const markedCount = mode === 'absent' ? absent.length : present.length
  const rows = view === 'present' ? present : absent

  const modeLabel = (m: AttendanceMode) => (m === 'absent' ? t('att.modeAbsent') : t('att.modePresent'))

  async function runMark(row: AttendanceRow, marking: boolean) {
    setBusyMember(row.member_id)
    try {
      await (marking ? markMember : unmarkMember).mutateAsync(row.member_id)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setBusyMember(null)
    }
  }

  async function confirmMode() {
    if (!pendingMode || eventId === null) return
    try {
      await setMode.mutateAsync(pendingMode)
      toast.success(t('att.modeChanged'))
      setPendingMode(null)
    } catch (err) {
      toast.error(errorMessage(err))
      setPendingMode(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteEvent.mutateAsync(deleteTarget.id)
      toast.success(t('att.deleted'))
      if (eventId === deleteTarget.id) onNavigate({ event: null })
      setDeleteTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
      setDeleteTarget(null)
    }
  }

  const exportRows = useMemo(() => rows, [rows])
  function exportCsv() {
    const ev = detail.data?.event
    if (!ev) return
    const csv = toCsv(
      [t('common.societyId'), t('members.fullName'), t('common.phone'), view === 'present' ? t('att.present') : t('att.absent'), t('att.time')],
      exportRows.map((r) => [r.society_id, r.full_name, r.phone ?? '', view === 'present' ? t('att.present') : t('att.absent'), r.marked_at ? formatTime(r.marked_at) : ''])
    )
    downloadCsv(`${ev.title.replace(/[^\w඀-෿-]+/g, '_')}-${String(ev.event_date).slice(0, 10)}-${view}.csv`, csv)
    toast.success(t('att.exported', { count: exportRows.length }))
  }

  return (
    <>
      <PageHeader
        title={t('att.title')}
        description={t('att.subtitle')}
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!detail.data || rows.length === 0}>
            <Download /> {t('ledger.exportCsv')}
          </Button>
        }
      />

      <div className="grid min-h-0 items-start gap-4 lg:grid-cols-[300px_1fr]">
        <EventList
          events={events.data ?? []}
          loading={events.isPending}
          selectedId={eventId}
          onSelect={(id) => onNavigate({ event: id, q: '' })}
          onCreate={() => setShowCreate(true)}
          onDelete={setDeleteTarget}
          className="lg:max-h-[calc(100vh-13rem)]"
        />

        <Card className="min-w-0">
          <CardContent className="grid gap-4">
            {events.isPending || (eventId !== null && detail.isPending) ? (
              <div className="grid gap-3" data-skeleton="attendance">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : detail.isError ? (
              <EmptyState icon={<AlertTriangle />} title={t('common.somethingWrong')} description={errorMessage(detail.error)} action={<Button onClick={() => void detail.refetch()}>{t('common.tryAgain')}</Button>} />
            ) : !detail.data ? (
              <EmptyState icon={<ScanLine />} title={t('att.selectEvent')} action={<Button onClick={() => setShowCreate(true)}>{t('att.newEvent')}</Button>} />
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{detail.data.event.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(detail.data.event.event_date, lang)}
                      <span aria-hidden> · </span>
                      {detail.data.event.type === 'meeting' ? t('att.typeMeeting') : detail.data.event.type === 'funeral' ? t('att.typeFuneral') : t('att.typeOther')}
                    </p>
                  </div>
                  {turnout !== null && (
                    <Badge variant={turnout >= 60 ? 'success' : turnout >= 30 ? 'warning' : 'danger'} className="tnum">
                      {t('att.turnout', { pct: turnout })}
                    </Badge>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <StatCard index={0} label={t('att.present')} value={formatNumber(present.length)} icon={<Users />} tone="success" />
                  <StatCard index={1} label={t('att.absent')} value={formatNumber(absent.length)} icon={<Users />} tone="danger" />
                  <StatCard index={2} label={t('att.activeMembers')} value={formatNumber(total)} icon={<CalendarCheck />} tone="neutral" />
                </div>

                <ScanPanel eventId={detail.data.event.id} mode={mode} onModeRequest={(m) => m !== mode && setPendingMode(m)} />

                <Tabs value={view} onValueChange={(v) => onNavigate({ view: v as AttendanceMode, q: '' })}>
                  <TabsList>
                    <TabsTrigger value="present">
                      {t('att.present')} <span className="tnum ml-1 text-muted-foreground">({present.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="absent">
                      {t('att.absent')} <span className="tnum ml-1 text-muted-foreground">({absent.length})</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                <RosterTable
                  rows={rows}
                  mode={mode}
                  view={view}
                  search={search}
                  onSearch={(q) => onNavigate({ q })}
                  loading={detail.isFetching && !detail.data}
                  busyMember={busyMember}
                  onMark={(r) => void runMark(r, true)}
                  onUnmark={(r) => void runMark(r, false)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <CreateEventDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(id) => onNavigate({ event: id, view: 'present', q: '' })} />

      <ConfirmDialog
        open={pendingMode !== null}
        onOpenChange={(o) => !o && setPendingMode(null)}
        title={t('att.switchMode')}
        description={
          markedCount > 0
            ? t('att.switchModeMsg', { title: detail.data?.event.title ?? '', mode: modeLabel(pendingMode ?? 'present'), count: markedCount })
            : t('att.switchModeEmpty', { title: detail.data?.event.title ?? '', mode: modeLabel(pendingMode ?? 'present') })
        }
        confirmLabel={t('att.switchMode')}
        danger={markedCount > 0}
        busy={setMode.isPending}
        onConfirm={confirmMode}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('att.deleteEvent')}
        description={t('att.deleteEventMsg', { title: deleteTarget?.title ?? '' })}
        confirmLabel={t('common.delete')}
        danger
        busy={deleteEvent.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}
