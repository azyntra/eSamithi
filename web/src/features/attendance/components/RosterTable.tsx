import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Search, Trash2, Undo2, UserMinus, UserPlus } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { isMarkedView, type AttendanceMode, type AttendanceRow } from '../types'
import { matchesMember } from '@/lib/members'

// One table for both sides. Whether a row can be removed or moved across
// depends on the method, not on which tab you are looking at: the tab holding
// individually-marked members is the editable one.
export function RosterTable({
  rows,
  mode,
  view,
  search,
  onSearch,
  loading,
  busyMember,
  onMark,
  onUnmark
}: {
  rows: AttendanceRow[]
  mode: AttendanceMode
  view: AttendanceMode
  search: string
  onSearch: (q: string) => void
  loading: boolean
  busyMember: number | null
  onMark: (row: AttendanceRow) => void
  onUnmark: (row: AttendanceRow) => void
}) {
  const { t } = useT()
  const byAbsence = mode === 'absent'
  const markedView = isMarkedView(mode, view)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => matchesMember({ id: r.member_id, ...r }, q))
  }, [rows, search])

  const columns = useMemo<ColumnDef<AttendanceRow, unknown>[]>(
    () => [
      {
        id: 'society_id',
        accessorFn: (r) => r.society_id ?? '',
        header: t('common.societyId'),
        meta: { width: '120px' },
        cell: ({ row }) => (
          <Badge variant={view === 'present' ? 'brand' : 'danger'} className="tnum font-bold">
            {row.original.society_id}
          </Badge>
        )
      },
      { id: 'full_name', accessorFn: (r) => r.full_name, header: t('members.fullName'), cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
      {
        id: 'meta',
        accessorFn: (r) => (r.marked_at ? r.marked_at : (r.phone ?? '')),
        header: markedView ? t('att.time') : t('common.phone'),
        meta: { width: '140px' },
        cell: ({ row }) => <span className="tnum text-muted-foreground">{markedView ? (row.original.marked_at ? formatTime(row.original.marked_at) : '—') : row.original.phone || '—'}</span>
      },
      {
        id: 'actions',
        header: t('common.actions'),
        enableSorting: false,
        meta: { align: 'center', width: '90px' },
        cell: ({ row }) => {
          const r = row.original
          const busy = busyMember === r.member_id
          return markedView ? (
            <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${byAbsence ? t('att.undoAbsent') : t('att.unmark')}: ${r.full_name}`} loading={busy} onClick={() => onUnmark(r)}>
              {byAbsence ? <Undo2 /> : <Trash2 />}
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              className={byAbsence ? 'text-danger hover:bg-danger-soft hover:text-danger' : 'text-success hover:bg-success-soft hover:text-success'}
              aria-label={`${byAbsence ? t('att.markAbsent') : t('att.mark')}: ${r.full_name}`}
              loading={busy}
              onClick={() => onMark(r)}
            >
              {byAbsence ? <UserMinus /> : <UserPlus />}
            </Button>
          )
        }
      }
    ],
    [t, view, markedView, byAbsence, busyMember, onMark, onUnmark]
  )

  const emptyText = search.trim()
    ? t('att.noMatches')
    : view === 'present'
      ? byAbsence
        ? t('att.allAbsent')
        : t('att.noneMarked')
      : byAbsence
        ? t('att.noneAbsentMarked')
        : t('att.noneAbsent')

  return (
    <div className="grid gap-3">
      <div className="relative sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-9 pl-9" placeholder={t('att.searchMembers')} aria-label={t('att.searchMembers')} value={search} onChange={(e) => onSearch(e.target.value)} autoComplete="off" />
      </div>
      <DataTable columns={columns} data={visible} loading={loading} skeletonRows={5} dense getRowId={(r) => String(r.member_id)} empty={<span className="text-muted-foreground">{emptyText}</span>} />
    </div>
  )
}
