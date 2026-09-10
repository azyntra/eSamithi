import { flag, int, isoDate, oneOfNum, str } from '@/lib/router/search'

export const PAGE_SIZES = [25, 50, 100] as const
export type Preset = 'all' | 'this_month' | 'last_month' | 'this_year'
export const PRESETS: Preset[] = ['all', 'this_month', 'last_month', 'this_year']

const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function presetRange(preset: Preset, now = new Date()): { from: string; to: string } {
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

export function activePreset(from: string, to: string, now = new Date()): Preset | 'custom' {
  for (const p of PRESETS) {
    const r = presetRange(p, now)
    if (r.from === from && r.to === to) return p
  }
  return 'custom'
}

const sizeOf = oneOfNum(PAGE_SIZES)

export interface LedgerSearch {
  q?: string
  type?: number
  from?: string
  to?: string
  page?: number
  size?: (typeof PAGE_SIZES)[number]
  member?: number // record-payment handoff (incomes)
  create?: 1 // open the record form straight from a link
}

// Ledger filters live in the URL (shareable, back-button friendly — FR-2.5)
export function parseLedgerSearch(search: Record<string, unknown>): LedgerSearch {
  return {
    q: str(search.q),
    type: int(search.type),
    from: isoDate(search.from),
    to: isoDate(search.to),
    page: int(search.page),
    size: sizeOf(search.size),
    member: int(search.member),
    create: flag(search.create)
  }
}
