import { currentLang, MONTHS_SHORT, type Lang } from '@/lib/i18n'

// Parses the leading YYYY-MM-DD of an ISO string instead of constructing a
// Date, so a UTC-midnight timestamp never renders as the previous day.
export function formatDate(value: string | Date | null | undefined, lang: Lang = currentLang()): string {
  if (!value) return '—'
  const months = MONTHS_SHORT[lang]
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—'
    return `${String(value.getDate()).padStart(2, '0')} ${months[value.getMonth()]} ${value.getFullYear()}`
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateTime(value: string | Date | null | undefined, lang: Lang = currentLang()): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(d, lang)} ${hh}:${mm}`
}

// Clock time only, 24-hour and zero-padded so a column of them lines up.
// The attendance register shows when each card was scanned.
export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// First ten characters when the value is ISO-like; empty otherwise. Used to
// feed <input type="date"> without a timezone shift.
export function toDateInput(value: string | null | undefined): string {
  if (!value) return ''
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1]! : ''
}

// Whole years between a YYYY-MM-DD birth date and today ("" when unknown)
export function calculateAge(dob: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob || '')
  if (!m) return ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const today = new Date()
  let age = today.getFullYear() - y
  const monthDiff = today.getMonth() + 1 - mo
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--
  return age >= 0 ? String(age) : ''
}
