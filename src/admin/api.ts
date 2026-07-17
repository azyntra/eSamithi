// Platform API client: bearer access token in memory, refresh token in
// sessionStorage, single-flight 401 → refresh → retry.
const BASE = '/pa/v1'
export const REFRESH_KEY = 'esamithi.pa.refresh'

let accessToken: string | null = null
let onSessionDead: (() => void) | null = null
let refreshing: Promise<boolean> | null = null

export function setAccessToken(t: string | null): void {
  accessToken = t
}
export function getAccessToken(): string | null {
  return accessToken
}
export function onSessionExpired(fn: () => void): void {
  onSessionDead = fn
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const stored = sessionStorage.getItem(REFRESH_KEY)
      if (!stored) return false
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: stored })
        })
        if (!res.ok) {
          sessionStorage.removeItem(REFRESH_KEY)
          return false
        }
        const d = await res.json()
        accessToken = d.token
        sessionStorage.setItem(REFRESH_KEY, d.refresh_token)
        return true
      } catch {
        return false
      } finally {
        // allow the next 401 to trigger a fresh attempt
        setTimeout(() => { refreshing = null }, 0)
      }
    })()
  }
  return refreshing
}

export async function api<T = unknown>(path: string, opts: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(opts.headers || {})
    }
  })
  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return api<T>(path, opts, true)
    onSessionDead?.()
    throw new ApiError('Session expired', 401)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status)
  return data as T
}

export const rs = (cents: number): string =>
  'Rs. ' + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(ms)) return String(iso).slice(0, 10)
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return String(iso).slice(0, 10)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return String(iso).replace('T', ' ').slice(0, 16)
}

export const pct = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0)

// Compact money for chart axes, where "Rs. 1,234,567.00" would never fit.
export function rsShort(cents: number): string {
  const v = cents / 100
  const a = Math.abs(v)
  if (a >= 1e6) return `Rs. ${(v / 1e6).toFixed(1)}M`
  if (a >= 1e3) return `Rs. ${Math.round(v / 1e3)}K`
  return `Rs. ${Math.round(v)}`
}

export interface Delta { pct: number; dir: 'up' | 'down' | 'flat' }

// Change against a baseline. Returns null when there's no baseline to compare
// with — the tiles hide the badge rather than imply a change from zero.
export function delta(current: number, previous: number | null | undefined): Delta | null {
  if (previous == null || !Number.isFinite(previous) || previous === 0) return null
  const diff = current - previous
  const p = Math.round((diff / Math.abs(previous)) * 100)
  if (p === 0) return { pct: 0, dir: 'flat' }
  return { pct: Math.abs(p), dir: diff > 0 ? 'up' : 'down' }
}

// Excel opens UTF-8 CSV as mojibake unless it sees a BOM — Sinhala society
// names depend on it.
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  const esc = (v: string | number | null): string => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const body = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Hands off to the browser's print dialog ("Save as PDF"). The @media print
// rules in styles.css strip the shell and reveal the letterhead.
export function exportPdf(): void {
  window.print()
}
