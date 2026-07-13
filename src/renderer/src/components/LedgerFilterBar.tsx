import React from 'react'
import { Search } from 'lucide-react'
import type { LedgerFilters } from '../hooks/useLedger'
import { useT } from '../i18n'

interface TypeOption {
  id: number
  name: string
}

interface LedgerFilterBarProps {
  filters: LedgerFilters
  setFilters: (update: Partial<LedgerFilters>) => void
  searchPlaceholder: string
  typeOptions: TypeOption[]
  typeLabel: string
}

type Preset = 'all' | 'this_month' | 'last_month' | 'this_year'

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const iso = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  switch (preset) {
    case 'this_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'last_month':
      return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case 'this_year':
      return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) }
    default:
      return { from: '', to: '' }
  }
}

function activePreset(filters: LedgerFilters): Preset | 'custom' {
  const presets: Preset[] = ['all', 'this_month', 'last_month', 'this_year']
  for (const p of presets) {
    const r = presetRange(p)
    if (r.from === filters.from && r.to === filters.to) return p
  }
  return 'custom'
}

export default function LedgerFilterBar({
  filters,
  setFilters,
  searchPlaceholder,
  typeOptions,
  typeLabel
}: LedgerFilterBarProps): React.ReactElement {
  const { t } = useT()
  const preset = activePreset(filters)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div className="search-container" style={{ position: 'relative', width: '260px' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="form-control"
          style={{ paddingLeft: '36px' }}
          value={filters.search}
          onChange={(e) => setFilters({ search: e.target.value })}
        />
      </div>

      <select
        className="form-control"
        style={{ width: 'auto', minWidth: '150px' }}
        value={filters.type_id}
        onChange={(e) => setFilters({ type_id: e.target.value === '' ? '' : Number(e.target.value) })}
        aria-label={typeLabel}
      >
        <option value="">{t('filter.all', { label: typeLabel })}</option>
        {typeOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>

      <select
        className="form-control"
        style={{ width: 'auto', minWidth: '130px' }}
        value={preset}
        onChange={(e) => {
          const value = e.target.value as Preset | 'custom'
          if (value !== 'custom') setFilters(presetRange(value as Preset))
        }}
        aria-label={t('filter.dateRange')}
      >
        <option value="all">{t('filter.allDates')}</option>
        <option value="this_month">{t('filter.thisMonth')}</option>
        <option value="last_month">{t('filter.lastMonth')}</option>
        <option value="this_year">{t('filter.thisYear')}</option>
        <option value="custom">{t('filter.custom')}</option>
      </select>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="date"
          className="form-control"
          style={{ width: 'auto' }}
          value={filters.from}
          onChange={(e) => setFilters({ from: e.target.value })}
          aria-label={t('filter.fromDate')}
        />
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('filter.to')}</span>
        <input
          type="date"
          className="form-control"
          style={{ width: 'auto' }}
          value={filters.to}
          onChange={(e) => setFilters({ to: e.target.value })}
          aria-label={t('filter.toDate')}
        />
      </div>
    </div>
  )
}
