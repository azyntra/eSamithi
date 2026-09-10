import type { FixedDeposit } from './api'

const parse = (iso: string): [number, number, number] | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
const fmt = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

// start + term months, clamped to the month length (31 Jan + 1 → 28/29 Feb).
// Pure date arithmetic — no Date/UTC round trip, so it never drifts a day.
export function addMonths(startIso: string, months: number): string {
  const p = parse(startIso)
  if (!p || !Number.isFinite(months)) return ''
  const [y, m, d] = p
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(ny, nm, 0).getDate()
  return fmt(ny, nm, Math.min(d, last))
}

function daysUntil(iso: string, now = new Date()): number | null {
  const p = parse(iso)
  if (!p) return null
  const target = new Date(p[0], p[1] - 1, p[2])
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export const isNearingMaturity = (iso: string, now = new Date()): boolean => {
  const d = daysUntil(iso, now)
  return d !== null && d >= 0 && d <= 30
}

// Active FDs past their maturity date show as Matured until withdrawn
export const fdDisplayStatus = (fd: Pick<FixedDeposit, 'status' | 'maturity_date'>, now = new Date()): FixedDeposit['status'] => {
  const d = daysUntil(fd.maturity_date, now)
  return fd.status === 'Active' && d !== null && d < 0 ? 'Matured' : fd.status
}
