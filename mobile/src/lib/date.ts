import { MONTHS_SHORT, type Lang } from '../i18n/months'

// The server returns DATE/TIMESTAMP columns as JS Dates, which serialize to
// full ISO strings ("2026-07-07T00:00:00.000Z"). Members only care about the
// calendar day. We parse the leading date part of the ISO string rather than
// constructing a Date, so a UTC midnight timestamp never shifts a day under
// the device timezone.
//
// Dates render in the UI language ("01 ජන 2026" / "01 Jan 2026"). The active
// language is pushed in by I18nProvider (setDateLang) so the dozens of
// existing formatDate() call sites stay signature-compatible; consumers
// re-render on language change anyway because the i18n context value changes.

let currentLang: Lang = 'si'

export function setDateLang(lang: Lang): void {
  currentLang = lang
}

function pretty(y: number, mo: number, da: number): string {
  const name = MONTHS_SHORT[currentLang][mo - 1]
  if (!name) return `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
  return `${String(da).padStart(2, '0')} ${name} ${y}`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const s = String(value)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return pretty(Number(m[1]), Number(m[2]), Number(m[3]))
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return pretty(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return s
}
