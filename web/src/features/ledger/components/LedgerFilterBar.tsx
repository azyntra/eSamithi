import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useT } from '@/lib/i18n'
import { activePreset, presetRange, type LedgerSearch, type Preset } from '../filters'

interface LedgerFilterBarProps {
  search: LedgerSearch
  onChange: (patch: Partial<LedgerSearch>) => void
  types: Array<{ id: number; name: string }>
  searchPlaceholder: string
}

export function LedgerFilterBar({ search, onChange, types, searchPlaceholder }: LedgerFilterBarProps) {
  const { t } = useT()
  const [text, setText] = useState(search.q ?? '')
  const debounced = useDebouncedValue(text.trim(), 300)
  useEffect(() => {
    if (debounced !== (search.q ?? '')) onChange({ q: debounced || undefined, page: undefined })
  }, [debounced]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setText(search.q ?? '')
  }, [search.q])

  const from = search.from ?? ''
  const to = search.to ?? ''
  const preset = activePreset(from, to)
  const anyFilter = Boolean(search.q || search.type || from || to)

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={searchPlaceholder} className="pl-9" aria-label={t('common.search')} />
      </div>
      <NativeSelect aria-label={t('ledger.types')} className="w-auto min-w-40" value={search.type ?? ''} onChange={(e) => onChange({ type: e.target.value ? Number(e.target.value) : undefined, page: undefined })}>
        <option value="">{t('filter.all', { label: t('ledger.types') })}</option>
        {types.map((ty) => (
          <option key={ty.id} value={ty.id}>
            {ty.name}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label={t('filter.dateRange')}
        className="w-auto min-w-36"
        value={preset}
        onChange={(e) => {
          const v = e.target.value as Preset | 'custom'
          if (v === 'custom') return
          const r = presetRange(v)
          onChange({ from: r.from || undefined, to: r.to || undefined, page: undefined })
        }}
      >
        <option value="all">{t('filter.allDates')}</option>
        <option value="this_month">{t('filter.thisMonth')}</option>
        <option value="last_month">{t('filter.lastMonth')}</option>
        <option value="this_year">{t('filter.thisYear')}</option>
        <option value="custom">{t('filter.custom')}</option>
      </NativeSelect>
      <div className="flex items-center gap-1.5">
        <Input type="date" aria-label={t('filter.fromDate')} className="w-auto" value={from} max={to || undefined} onChange={(e) => onChange({ from: e.target.value || undefined, page: undefined })} />
        <span className="text-xs text-muted-foreground">{t('filter.to')}</span>
        <Input type="date" aria-label={t('filter.toDate')} className="w-auto" value={to} min={from || undefined} onChange={(e) => onChange({ to: e.target.value || undefined, page: undefined })} />
      </div>
      {anyFilter && (
        <Button variant="ghost" size="sm" onClick={() => { setText(''); onChange({ q: undefined, type: undefined, from: undefined, to: undefined, page: undefined }) }}>
          <X /> {t('ledger.clearFilters')}
        </Button>
      )}
    </div>
  )
}
