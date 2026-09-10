import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Ban, Flag, Plus, RotateCcw, Search, Store } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { StatusPill } from '@/components/StatusPill'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { errorMessage } from '@/lib/api/errors'
import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useT } from '@/lib/i18n'
import { useCreateCategory, usePurukaCategories, usePurukaPosts, useRestorePost, useTakeDownPost, useUpdateCategory } from '../queries'
import type { PurukaCategory, PurukaPost } from '../types'

const STATUSES = ['Active', 'Sold', 'Inactive', 'Removed', 'Deleted']

// Moderation for the community exchange. Reported posts sort to the top
// server-side, so the queue is already in the order it should be worked.
export function PurukaTab() {
  const { t, lang } = useT()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [reportedOnly, setReportedOnly] = useState(false)
  const debounced = useDebouncedValue(search, 300)

  const filters = useMemo(
    () => ({
      q: debounced.trim() || undefined,
      status: status || undefined,
      category: category ? Number(category) : undefined,
      reported: reportedOnly ? ('1' as const) : undefined
    }),
    [debounced, status, category, reportedOnly]
  )

  const posts = usePurukaPosts(filters)
  const categories = usePurukaCategories()
  const takeDown = useTakeDownPost()
  const restore = useRestorePost()
  const [target, setTarget] = useState<PurukaPost | null>(null)

  async function onRestore(post: PurukaPost) {
    try {
      await restore.mutateAsync(post.id)
      toast.success(t('msg.pkReactivated'))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onTakeDown() {
    if (!target) return
    try {
      await takeDown.mutateAsync(target.id)
      toast.success(t('msg.pkDeactivated'))
      setTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
      setTarget(null)
    }
  }

  const columns = useMemo<ColumnDef<PurukaPost, unknown>[]>(
    () => [
      {
        id: 'title',
        accessorFn: (p) => p.title,
        header: t('msg.title'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.title}</div>
            {row.original.location && <div className="truncate text-xs text-muted-foreground">{row.original.location}</div>}
          </div>
        )
      },
      { id: 'category', accessorFn: (p) => p.category_label, header: t('msg.pkCategory') },
      {
        id: 'seller',
        accessorFn: (p) => p.seller_name,
        header: t('msg.pkSeller'),
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-medium">{row.original.seller_name}</div>
            <div className="tnum text-xs text-muted-foreground">{row.original.seller_society_id}</div>
          </div>
        )
      },
      {
        id: 'price',
        accessorFn: (p) => p.price ?? -1,
        header: t('common.amount'),
        meta: { align: 'right' },
        cell: ({ row }) => <span className="tnum">{row.original.price !== null ? formatCurrency(row.original.price) : t('msg.pkNegotiable')}</span>
      },
      { id: 'status', accessorFn: (p) => p.status, header: t('common.status'), cell: ({ row }) => <StatusPill value={row.original.status} /> },
      {
        id: 'reports',
        accessorFn: (p) => p.report_count,
        header: t('msg.pkReports'),
        meta: { align: 'center' },
        cell: ({ row }) =>
          row.original.report_count > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="danger" className="tnum gap-1">
                  <Flag className="size-3" /> {row.original.report_count}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{row.original.report_reasons ?? ''}</TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
      },
      {
        id: 'expires',
        accessorFn: (p) => p.expires_at,
        header: t('msg.pkExpires'),
        cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.expires_at, lang)}</span>
      },
      {
        id: 'actions',
        header: t('common.actions'),
        enableSorting: false,
        meta: { align: 'center', width: '80px' },
        cell: ({ row }) =>
          row.original.status === 'Removed' ? (
            <Button size="icon-sm" variant="ghost" className="text-success hover:bg-success-soft hover:text-success" aria-label={`${t('msg.pkReactivate')}: ${row.original.title}`} onClick={() => void onRestore(row.original)}>
              <RotateCcw />
            </Button>
          ) : (
            <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('msg.pkDeactivate')}: ${row.original.title}`} onClick={() => setTarget(row.original)}>
              <Ban />
            </Button>
          )
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, lang]
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-9" placeholder={t('msg.pkSearchPh')} aria-label={t('msg.pkSearchPh')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <NativeSelect className="h-9 w-auto" aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('msg.pkAllStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect className="h-9 w-auto" aria-label={t('msg.pkCategory')} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('msg.pkAllCategories')}</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {lang === 'si' ? c.label_si : c.label_en}
            </option>
          ))}
        </NativeSelect>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={reportedOnly} onChange={(e) => setReportedOnly(e.target.checked)} />
          <Flag className="size-3.5 text-danger" /> {t('msg.pkReportedOnly')}
        </label>
      </div>

      <DataTable columns={columns} data={posts.data ?? []} loading={posts.isPending} dense getRowId={(p) => String(p.id)} empty={<span className="text-muted-foreground">{t('msg.pkNoPosts')}</span>} />

      <CategoryManager categories={categories.data ?? []} loading={categories.isPending} />

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(o) => !o && setTarget(null)}
        title={t('msg.pkDeactivate')}
        description={t('msg.pkDeactivateMsg', { title: target?.title ?? '' })}
        confirmLabel={t('msg.pkDeactivate')}
        danger
        busy={takeDown.isPending}
        onConfirm={onTakeDown}
      />
    </div>
  )
}

function CategoryManager({ categories, loading }: { categories: PurukaCategory[]; loading: boolean }) {
  const { t, lang } = useT()
  const create = useCreateCategory()
  const update = useUpdateCategory()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ code: '', label_en: '', label_si: '' })
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      await create.mutateAsync(form)
      toast.success(t('msg.pkCatAdded'))
      setForm({ code: '', label_en: '', label_si: '' })
      setOpen(false)
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function toggle(c: PurukaCategory) {
    try {
      await update.mutateAsync({ id: c.id, is_active: !c.is_active })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Store className="size-4 text-muted-foreground" /> {t('msg.pkCategories')}
        </CardTitle>
        <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
          <Plus /> {t('msg.pkAddCategory')}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3">
        {open && (
          <form onSubmit={submit} className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input aria-label={t('msg.pkCatCode')} placeholder={t('msg.pkCatCode')} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <Input aria-label={t('msg.pkCatEn')} placeholder={t('msg.pkCatEn')} value={form.label_en} onChange={(e) => setForm({ ...form, label_en: e.target.value })} />
            <Input aria-label={t('msg.pkCatSi')} placeholder={t('msg.pkCatSi')} value={form.label_si} onChange={(e) => setForm({ ...form, label_si: e.target.value })} />
            <Button type="submit" size="sm" loading={create.isPending}>
              {t('common.save')}
            </Button>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger sm:col-span-4">
                {error}
              </p>
            )}
          </form>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5">
                <span className={c.is_active ? 'text-sm font-medium' : 'text-sm text-muted-foreground line-through'}>{lang === 'si' ? c.label_si : c.label_en}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => void toggle(c)}>
                  {c.is_active ? t('msg.pkDisable') : t('msg.pkEnable')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
