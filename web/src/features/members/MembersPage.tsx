import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Eye, Pencil, Plus, ScanLine, Search, Trash2, Users } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { Pagination } from '@/components/Pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { errorMessage } from '@/lib/api/errors'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useT } from '@/lib/i18n'
import { formatNumber } from '@/lib/format/currency'
import { DeleteMemberDialog } from './components/DeleteMemberDialog'
import { MemberFormSheet } from './components/MemberForm'
import { ScanCardDialog } from './components/ScanCardDialog'
import { useMembersList } from './queries'
import { isMemberActive, type Member } from './types'

interface MembersPageProps {
  q: string
  page: number
  size: number
}

export function MembersPage({ q, page, size }: MembersPageProps) {
  const { t } = useT()
  const navigate = useNavigate({ from: '/members/' })
  const [text, setText] = useState(q)
  const debounced = useDebouncedValue(text.trim(), 300)
  const [formOpen, setFormOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [scanOpen, setScanOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)

  // Search text lives in the URL (shareable, back-button friendly); typing is debounced
  useEffect(() => {
    if (debounced === q) return
    void navigate({ search: (prev) => ({ ...prev, q: debounced || undefined, page: undefined }), replace: true })
  }, [debounced, q, navigate])

  const list = useMembersList({ search: q, page, limit: size })
  const rows = list.data?.members ?? []
  const total = list.data?.total ?? 0

  const open = useCallback((id: number) => void navigate({ to: '/members/$memberId', params: { memberId: id }, search: { tab: undefined } }), [navigate])

  const columns = useMemo<ColumnDef<Member, unknown>[]>(
    () => [
      {
        accessorKey: 'society_id',
        header: t('common.societyId'),
        meta: { width: '9rem' },
        cell: ({ row }) => (
          <Badge variant="outline" className="tnum font-mono text-[11px] font-semibold">
            {row.original.society_id}
          </Badge>
        )
      },
      {
        accessorKey: 'full_name',
        header: t('members.fullName'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Link to="/members/$memberId" params={{ memberId: row.original.id }} search={{ tab: undefined }} className="font-medium text-foreground hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {row.original.full_name || '—'}
            </Link>
            {!isMemberActive(row.original) && <Badge variant="neutral">{t('common.inactive')}</Badge>}
          </div>
        )
      },
      { accessorKey: 'nic', header: t('members.nic'), cell: ({ getValue }) => <span className="font-mono text-[13px]">{(getValue() as string | null) || '—'}</span> },
      {
        accessorKey: 'address',
        header: t('members.address'),
        enableSorting: false,
        cell: ({ getValue }) => <span className="block max-w-[260px] truncate text-muted-foreground">{(getValue() as string | null) || '—'}</span>
      },
      { accessorKey: 'occupation', header: t('members.occupation'), cell: ({ getValue }) => <span className="text-muted-foreground">{(getValue() as string | null) || '—'}</span> },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        enableSorting: false,
        meta: { align: 'right', width: '8rem' },
        cell: ({ row }) => {
          const m = row.original
          const name = m.full_name || m.society_id
          return (
            <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t('members.viewDetails')}: ${name}`} onClick={() => open(m.id)}>
                    <Eye />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('members.viewDetails')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`${t('members.edit')}: ${name}`} onClick={() => { setEditId(m.id); setFormOpen(true) }}>
                    <Pencil />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('members.edit')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('members.delete')}: ${name}`} onClick={() => setDeleteTarget(m)}>
                    <Trash2 />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('members.delete')}</TooltipContent>
              </Tooltip>
            </div>
          )
        }
      }
    ],
    [t, open]
  )

  return (
    <>
      <PageHeader
        title={t('members.title')}
        description={t('members.subtitle')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setScanOpen(true)}>
              <ScanLine /> {t('members.scanCard')}
            </Button>
            <Button onClick={() => { setEditId(null); setFormOpen(true) }}>
              <Plus /> {t('members.add')}
            </Button>
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('members.searchPlaceholder')} className="pl-9" aria-label={t('common.search')} />
          </div>
          <div className="text-right leading-tight">
            <div className="text-xs text-muted-foreground">{t('members.totalMembers')}</div>
            <div className="tnum text-lg font-semibold text-primary">{formatNumber(total)}</div>
          </div>
        </div>

        {list.isError ? (
          <div className="p-6">
            <EmptyState icon={<AlertTriangle />} title={t('common.somethingWrong')} description={errorMessage(list.error)} action={<Button onClick={() => void list.refetch()}>{t('common.tryAgain')}</Button>} />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              data={rows}
              loading={list.isPending}
              getRowId={(m) => String(m.id)}
              onRowClick={(row) => open(row.original.id)}
              empty={
                <EmptyState
                  className="m-4"
                  icon={<Users />}
                  title={t('members.noneFound')}
                  description={q ? t('members.tryAdjusting') : t('members.clickAddFirst')}
                  action={
                    q ? undefined : (
                      <Button onClick={() => { setEditId(null); setFormOpen(true) }}>
                        <Plus /> {t('members.add')}
                      </Button>
                    )
                  }
                />
              }
            />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={size}
                total={total}
                summary={(s, e, tot) => t('members.showing', { start: s, end: e, total: tot })}
                onPageChange={(p) => void navigate({ search: (prev) => ({ ...prev, page: p === 1 ? undefined : p }) })}
                onPageSizeChange={(n) => void navigate({ search: (prev) => ({ ...prev, size: n === 15 ? undefined : (n as 30 | 50), page: undefined }) })}
              />
            )}
          </>
        )}
      </Card>

      <MemberFormSheet open={formOpen} onOpenChange={setFormOpen} memberId={editId} />
      <ScanCardDialog open={scanOpen} onOpenChange={setScanOpen} />
      <DeleteMemberDialog member={deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)} />
    </>
  )
}
