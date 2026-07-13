// The server returns DATE/TIMESTAMP columns as JS Dates, which serialize to
// full ISO strings ("2026-07-07T00:00:00.000Z"). Members only care about the
// calendar day, so collapse everything to YYYY-MM-DD. We slice the leading
// date part of the ISO string rather than constructing a Date, so a UTC
// midnight timestamp never shifts a day under the device timezone.
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const s = String(value)
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const da = String(d.getDate()).padStart(2, '0')
    return `${y}-${mo}-${da}`
  }
  return s
}
