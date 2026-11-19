import type { AxiosError } from 'axios'

// Pure helpers for the attendance scanner — kept out of the screens so the
// rules (what counts as a card, when a repeat scan is ignored, how an error
// is classified) live in one place.

// A membership QR carries the bare society ID. Links, payment codes and
// anything with spaces belong to some other system and are rejected on the
// phone, without a server round trip (requirements FR-4.14). Mirrors
// server/lib/attendance.js parseCardPayload.
export function parseCardPayload(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value || value.length > 50) return null
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /\s/.test(value)) return null
  return value
}

// The camera reports the same code many times a second while a card is in
// view. Each distinct code is accepted once per window (FR-4.4).
export function createRepeatGuard(windowMs = 3000, now: () => number = Date.now) {
  const seen = new Map<string, number>()
  return (code: string): boolean => {
    const key = code.toLowerCase()
    const t = now()
    const last = seen.get(key)
    if (last !== undefined && t - last < windowMs) return false
    seen.set(key, t)
    // Keep the map small during a long event
    if (seen.size > 200) {
      for (const [k, v] of seen) if (t - v >= windowMs) seen.delete(k)
    }
    return true
  }
}

export type MarkFailure =
  | { kind: 'not_staff' } // permission removed or feature switched off
  | { kind: 'closed' } // event outside the yesterday–tomorrow window
  | { kind: 'not_found' } // no member with that society ID
  | { kind: 'rate_limited' }
  | { kind: 'offline' } // never reached the server: keep and retry
  | { kind: 'other'; message: string }

export function classifyMarkError(err: unknown): MarkFailure {
  const ax = err as AxiosError<{ error?: string; code?: string }>
  const status = ax?.response?.status
  const code = ax?.response?.data?.code
  if (!ax?.response) return { kind: 'offline' }
  if (status === 403 && (code === 'NOT_STAFF' || code === 'FEATURE_OFF')) return { kind: 'not_staff' }
  if (status === 409 || code === 'EVENT_CLOSED') return { kind: 'closed' }
  if (status === 404 && code === 'MEMBER_NOT_FOUND') return { kind: 'not_found' }
  if (status === 429) return { kind: 'rate_limited' }
  if (status !== undefined && status >= 500) return { kind: 'offline' }
  return { kind: 'other', message: ax?.response?.data?.error ?? String(ax?.message ?? 'Error') }
}

// RFC 4122 v4 for client_ref (lets a retried scan be recognised server-side)
export function uuid4(): string {
  const hex = '0123456789abcdef'
  let out = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-'
    else if (i === 14) out += '4'
    else if (i === 19) out += hex[(Math.random() * 4) | 8]
    else out += hex[(Math.random() * 16) | 0]
  }
  return out
}

// Today / tomorrow / yesterday relative to the server's society date
export function dayLabelKey(eventDate: string, today: string): 'mob.attToday' | 'mob.attTomorrow' | 'mob.attYesterday' | null {
  const toUtc = (s: string) => {
    const [y, m, d] = s.slice(0, 10).split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  const diff = Math.round((toUtc(eventDate) - toUtc(today)) / 86400000)
  return diff === 0 ? 'mob.attToday' : diff === 1 ? 'mob.attTomorrow' : diff === -1 ? 'mob.attYesterday' : null
}

// The open window as dates, for the create form's three choices
export function windowDates(today: string): { yesterday: string; today: string; tomorrow: string } {
  const [y, m, d] = today.split('-').map(Number)
  const at = (delta: number) => new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10)
  return { yesterday: at(-1), today, tomorrow: at(1) }
}
