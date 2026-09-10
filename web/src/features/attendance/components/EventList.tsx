import { CalendarCheck, Plus, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/format/dates'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { EventType, SocietyEvent } from '../types'

const TYPE_VARIANT: Record<EventType, 'default' | 'danger' | 'neutral'> = {
  meeting: 'default',
  funeral: 'danger',
  other: 'neutral'
}

export function EventList({
  events,
  loading,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  className
}: {
  events: SocietyEvent[]
  loading: boolean
  selectedId: number | null
  onSelect: (id: number) => void
  onCreate: () => void
  onDelete: (ev: SocietyEvent) => void
  className?: string
}) {
  const { t, lang } = useT()

  return (
    <aside className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card', className)} aria-label={t('att.events')}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">{t('att.events')}</span>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          <Plus /> {t('att.newEvent')}
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-2 p-3" data-skeleton="events">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="grid place-items-center gap-2 p-8 text-center">
          <CalendarCheck className="size-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('att.noEvents')}</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {events.map((ev) => {
            const selected = ev.id === selectedId
            return (
              <li key={ev.id} className="border-b border-border last:border-b-0">
                <div className={cn('group flex items-center gap-1 border-l-[3px] transition-colors', selected ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted/60')}>
                  <button
                    type="button"
                    data-event={ev.id}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onSelect(ev.id)}
                    className="min-w-0 flex-1 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                  >
                    <div className="truncate text-[14px] font-semibold">{ev.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={TYPE_VARIANT[ev.type] ?? 'neutral'} className="text-[11px]">
                        {ev.type === 'meeting' ? t('att.typeMeeting') : ev.type === 'funeral' ? t('att.typeFuneral') : t('att.typeOther')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(ev.event_date, lang)}</span>
                      <span className="tnum inline-flex items-center gap-1 text-xs text-muted-foreground" title={t('att.present')}>
                        <Users className="size-3" /> {ev.attendee_count}
                      </span>
                      {ev.attendance_mode === 'absent' && (
                        <Badge variant="warning" className="text-[11px]">
                          {t('att.modeAbsent')}
                        </Badge>
                      )}
                    </div>
                  </button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    className="mr-2 text-danger opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`${t('att.deleteEvent')}: ${ev.title}`}
                    onClick={() => onDelete(ev)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
