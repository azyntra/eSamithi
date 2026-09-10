import { useState } from 'react'
import { CalendarDays, Eye, EyeOff, Flower2, Megaphone, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { errorMessage } from '@/lib/api/errors'
import { formatDate, formatDateTime } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AnnouncementSheet } from './AnnouncementSheet'
import { useAnnouncements, useDeleteAnnouncement, useToggleAnnouncement } from '../queries'
import type { Announcement, AnnouncementType } from '../types'

const TYPE_META: Record<AnnouncementType, { icon: typeof Megaphone; tone: string; variant: 'danger' | 'default' | 'success' }> = {
  death: { icon: Flower2, tone: 'bg-danger-soft text-danger', variant: 'danger' },
  meeting: { icon: CalendarDays, tone: 'bg-accent text-primary', variant: 'default' },
  general: { icon: Megaphone, tone: 'bg-success-soft text-success', variant: 'success' }
}

export function AnnouncementsTab() {
  const { t, lang } = useT()
  const list = useAnnouncements()
  const toggle = useToggleAnnouncement()
  const remove = useDeleteAnnouncement()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null)

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }
  function openEdit(a: Announcement) {
    setEditing(a)
    setSheetOpen(true)
  }

  async function onToggle(a: Announcement) {
    try {
      await toggle.mutateAsync(a.id)
      toast.success(a.is_active ? t('msg.nowHidden') : t('msg.nowVisible'))
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync(deleteTarget.id)
      toast.success(t('msg.deleted'))
      setDeleteTarget(null)
    } catch (err) {
      toast.error(errorMessage(err))
      setDeleteTarget(null)
    }
  }

  const items = list.data ?? []

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t('msg.subtitle')}</p>
        <Button size="sm" onClick={openNew}>
          <Plus /> {t('msg.newAnnouncement')}
        </Button>
      </div>

      {list.isPending ? (
        <div className="grid gap-3" data-skeleton="announcements">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title={t('msg.noAnnouncements')} action={<Button onClick={openNew}>{t('msg.newAnnouncement')}</Button>} />
      ) : (
        <ul className="grid gap-3">
          {items.map((a) => {
            const meta = TYPE_META[a.type] ?? TYPE_META.general
            const Icon = meta.icon
            return (
              <li key={a.id}>
                <Card className={cn('gap-0 transition-opacity', !a.is_active && 'opacity-70')} data-announcement={a.id}>
                  <CardContent className="flex flex-wrap items-start gap-3 py-4">
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', meta.tone)}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{a.title}</span>
                        <Badge variant={meta.variant} className="text-[11px]">
                          {a.type === 'death' ? t('msg.typeDeath') : a.type === 'meeting' ? t('msg.typeMeeting') : t('msg.typeGeneral')}
                        </Badge>
                        {!a.is_active && (
                          <Badge variant="neutral" className="text-[11px]">
                            {t('msg.hidden')}
                          </Badge>
                        )}
                      </div>
                      {a.type === 'death' && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[a.deceased_member_name ?? a.deceased_name, a.funeral_date ? `${t('msg.funeralDate')}: ${formatDate(a.funeral_date, lang)}` : null, a.funeral_location].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {a.type === 'meeting' && a.event_date && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {t('msg.eventDate')}: {formatDate(a.event_date, lang)}
                        </p>
                      )}
                      {a.body && <p className="mt-1 text-sm whitespace-pre-line text-foreground/90">{a.body}</p>}
                      <p className="mt-1.5 text-xs text-subtle-foreground">{formatDateTime(a.created_at, lang)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`${t('common.edit')}: ${a.title}`} onClick={() => openEdit(a)}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`${a.is_active ? t('msg.hide') : t('msg.show')}: ${a.title}`} onClick={() => void onToggle(a)}>
                        {a.is_active ? <EyeOff /> : <Eye />}
                      </Button>
                      <Button size="icon-sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" aria-label={`${t('common.delete')}: ${a.title}`} onClick={() => setDeleteTarget(a)}>
                        <Trash2 />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      <AnnouncementSheet open={sheetOpen} onOpenChange={setSheetOpen} editing={editing} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('common.delete')}
        description={t('msg.deleteConfirm')}
        confirmLabel={t('common.delete')}
        danger
        busy={remove.isPending}
        onConfirm={onDelete}
      />
    </div>
  )
}
