import { useEffect, useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PageImage } from '../types'

// The report's photographed pages (§8.3.3): a thumbnail strip and one large
// page. The images are the very pages the PDF is made of, so no PDF viewer is
// needed. Zoom shows the page at full size inside a scrolling box.
export function PageViewer({ pages, page, onPageChange }: { pages: PageImage[]; page?: number; onPageChange?: (n: number) => void }) {
  const { t } = useT()
  const [index, setIndex] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [failed, setFailed] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (page && page >= 1 && page <= pages.length) setIndex(page - 1)
  }, [page, pages.length])
  useEffect(() => {
    if (index > pages.length - 1) setIndex(0)
  }, [index, pages.length])

  const go = (i: number) => {
    const next = Math.max(0, Math.min(pages.length - 1, i))
    setIndex(next)
    onPageChange?.(next + 1)
  }
  const current = pages[index]
  if (!current) return null

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') go(index - 1)
    if (e.key === 'ArrowRight') go(index + 1)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-3 md:flex-row">
        <ol aria-label={t('mm.pages')} className="flex shrink-0 gap-2 overflow-x-auto pb-1 md:max-h-[640px] md:flex-col md:overflow-y-auto md:pb-0">
          {pages.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                aria-label={t('mm.pageOf', { n: p.n, total: pages.length })}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => go(i)}
                className={cn('relative block w-16 overflow-hidden rounded-md border bg-white', i === index ? 'border-primary ring-2 ring-primary/30' : 'border-border')}
              >
                <img src={p.thumb_url} alt="" loading="lazy" className="block h-20 w-full object-contain" />
                <span className="tnum absolute bottom-0.5 left-0.5 rounded bg-foreground/80 px-1 text-[11px] font-semibold text-background">{p.n}</span>
              </button>
            </li>
          ))}
        </ol>
        <div
          role="region"
          aria-label={t('mm.pageOf', { n: index + 1, total: pages.length })}
          tabIndex={0}
          onKeyDown={onKey}
          className={cn('relative min-w-0 flex-1 rounded-lg border border-border bg-muted/40 outline-none focus-visible:ring-[3px] focus-visible:ring-ring', zoomed ? 'max-h-[720px] overflow-auto' : 'grid place-items-center overflow-hidden p-3')}
        >
          {failed[current.id] ? (
            <div className="grid place-items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <p>{t('mm.pageLoadFailed', { n: index + 1 })}</p>
              <Button size="sm" variant="secondary" onClick={() => setFailed((f) => ({ ...f, [current.id]: false }))}>
                {t('common.retry')}
              </Button>
            </div>
          ) : (
            <img
              key={current.url}
              src={current.url}
              alt={t('mm.pageOf', { n: index + 1, total: pages.length })}
              onError={() => setFailed((f) => ({ ...f, [current.id]: true }))}
              className={cn('bg-white shadow-sm', zoomed ? 'max-w-none' : 'max-h-[640px] w-auto max-w-full object-contain')}
              style={zoomed ? { width: current.width } : undefined}
            />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button size="icon-sm" variant="secondary" aria-label={t('mm.prevPage')} disabled={index === 0} onClick={() => go(index - 1)}>
          <ChevronLeft />
        </Button>
        <span className="tnum min-w-28 text-center text-sm font-medium">{t('mm.pageOf', { n: index + 1, total: pages.length })}</span>
        <Button size="icon-sm" variant="secondary" aria-label={t('mm.nextPage')} disabled={index === pages.length - 1} onClick={() => go(index + 1)}>
          <ChevronRight />
        </Button>
        <Button size="sm" variant="ghost" aria-pressed={zoomed} onClick={() => setZoomed((z) => !z)}>
          {zoomed ? <ZoomOut /> : <ZoomIn />} {zoomed ? t('mm.fitPage') : t('mm.fullSize')}
        </Button>
      </div>
    </div>
  )
}
