import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { useT } from '@/lib/i18n'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizes?: number[]
  summary?: (start: number, end: number, total: number) => string
}

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [15, 30, 50], summary }: PaginationProps) {
  const { t } = useT()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
      <span className="tnum">{summary ? summary(start, end, total) : t('common.showingRows', { start, end, total })}</span>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <label className="flex items-center gap-2 text-xs">
            {t('common.rowsPerPage')}
            <NativeSelect className="h-8 w-20 py-0 text-xs" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </NativeSelect>
          </label>
        )}
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label={t('common.previous')} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="tnum min-w-16 text-center text-xs">
            {page} / {pages}
          </span>
          <Button variant="outline" size="icon-sm" aria-label={t('common.next')} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
