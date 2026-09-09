import { z } from 'zod'

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

const optStr = z.string().optional().catch(undefined)
const optDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)
const optNum = z.coerce.number().int().positive().optional().catch(undefined)

// Ledger filters live in the URL (shareable, back-button friendly — FR-2.5)
export const ledgerSearchSchema = z.object({
  q: optStr,
  type: optNum,
  from: optDate,
  to: optDate,
  page: optNum,
  size: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZES as readonly number[]).includes(n))
    .optional()
    .catch(undefined),
  member: optNum // record-payment handoff (incomes)
})
export type LedgerSearch = z.infer<typeof ledgerSearchSchema>
