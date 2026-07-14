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
