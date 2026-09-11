// Staff session manager (requirements §6.5, client side).
//  - access token: 15-min JWT kept ONLY in this module (never web storage)
//  - refresh token: HttpOnly cookie the browser sends to /api/v1/auth/* alone
//  - refresh is single-flight across tabs (Web Locks) and retried once on the
//    two-tab RACED answer; logout fans out over a BroadcastChannel.
import { useSyncExternalStore } from 'react'
import { ApiError } from './errors'
import { apiBase, clearSamithi, loadSamithi, type SamithiContext } from './samithi'
import { clearHandoff, loadHandoff, type SupportHandoff } from './support'

export type Role = 'admin' | 'user' | 'viewer'
export interface SessionUser {
  id: number
  username: string
  full_name: string
  role: Role
  must_change_password?: boolean
}
export type SessionStatus = 'unknown' | 'anonymous' | 'authenticated' | 'expired'
/** Present only while an eSamithi operator is inside a society (FR-15). */
export interface SupportContext {
  /** 'sa:<id>' — the platform admin the tenant API recorded on every write */
  actor: string
  sid: string
  /** Epoch ms; 0 when the API did not say. The token is hard-capped at 60 min. */
  expiresAt: number
  /** Console origin to return to, or null if we were opened without one */
  returnTo: string | null
}
export interface SessionState {
  status: SessionStatus
  user: SessionUser | null
  samithi: SamithiContext | null
  expiresAt: number
  support: SupportContext | null
}

const listeners = new Set<() => void>()
let state: SessionState = { status: 'unknown', user: null, samithi: loadSamithi(), expiresAt: 0, support: null }
let accessToken: string | null = null
let sid: string | null = null
let refreshPromise: Promise<boolean> | null = null
let ensurePromise: Promise<void> | null = null
let refreshTimer: number | null = null
let lastActivity = Date.now()

const channel: BroadcastChannel | null = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('esamithi-auth') : null

function emit(): void {
  listeners.forEach((l) => l())
}
function setState(patch: Partial<SessionState>): void {
  state = { ...state, ...patch }
  emit()
}

export function getSessionState(): SessionState {
  return state
}
export function subscribeSession(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionState, getSessionState)
}
export const isAuthenticated = (): boolean => state.status === 'authenticated' && accessToken !== null
export const isSupportMode = (): boolean => state.support !== null
export const getAccessToken = (): string | null => accessToken
export const getSid = (): string | null => sid
export const noteActivity = (): void => {
  lastActivity = Date.now()
}

function decodeSid(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sid?: string }
    return payload.sid ?? null
  } catch {
    return null
  }
}

function adopt(token: string, expiresIn: number, user?: SessionUser): void {
  accessToken = token
  sid = decodeSid(token)
  setState({ status: 'authenticated', expiresAt: Date.now() + expiresIn * 1000, ...(user ? { user } : {}) })
  scheduleRefresh(expiresIn)
}

function drop(status: SessionStatus): void {
  accessToken = null
  sid = null
  if (refreshTimer) window.clearTimeout(refreshTimer)
  refreshTimer = null
  setState({ status, user: status === 'expired' ? state.user : null, expiresAt: 0 })
}

// Proactive refresh two minutes before expiry, but only for an active user —
// a tab left open overnight lapses and re-authenticates on the next click.
function scheduleRefresh(expiresIn: number): void {
  if (refreshTimer) window.clearTimeout(refreshTimer)
  const delay = Math.max(15_000, (expiresIn - 120) * 1000)
  refreshTimer = window.setTimeout(() => {
    if (Date.now() - lastActivity < 5 * 60_000) void refresh()
  }, delay)
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'eSamithi', ...extra }
  if (state.samithi) h['X-Samithi'] = state.samithi.slug
  return h
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>
}

export function setSamithi(ctx: SamithiContext | null): void {
  setState({ samithi: ctx })
}

export function forgetSamithi(): void {
  clearSamithi()
  drop('anonymous')
  setState({ samithi: null })
}

interface SessionResponse {
  success?: boolean
  user?: SessionUser
  access_token?: string
  expires_in?: number
  error?: string
  code?: string
  retry_after_seconds?: number
}

export async function signIn(username: string, password: string): Promise<SessionUser> {
  if (!state.samithi) throw new ApiError(0, 'No samithi selected', null, 'NO_SAMITHI')
  const res = await fetch(`${apiBase()}/auth/session`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ username, password })
  })
  const body = (await readJson(res)) as SessionResponse
  if (!res.ok || !body.access_token || !body.user) {
    throw new ApiError(res.status, body.error || 'Sign-in failed', body, body.code ?? null)
  }
  adopt(body.access_token, body.expires_in ?? 900, body.user)
  channel?.postMessage({ type: 'signed-in' })
  return body.user
}

// Single-flight, cross-tab refresh. Resolves true when a new access token is in hand.
export function refresh(): Promise<boolean> {
  // Support mode holds one fixed platform token. There is no cookie to rotate,
  // so a 401 is not a lapsed session to renew — it is the end of the session,
  // either because the hour ran out or because the console revoked it.
  if (state.support) return Promise.resolve(false)
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const run = async (): Promise<boolean> => {
        for (let attempt = 0; attempt < 2; attempt++) {
          const res = await fetch(`${apiBase()}/auth/refresh`, { method: 'POST', credentials: 'same-origin', headers: authHeaders() })
          if (res.ok) {
            const body = (await readJson(res)) as SessionResponse
            if (body.access_token) {
              adopt(body.access_token, body.expires_in ?? 900)
              if (!state.user) await loadMe().catch(() => undefined)
              return true
            }
            return false
          }
          const body = (await readJson(res)) as SessionResponse
          if (res.status === 401 && body.code === 'RACED' && attempt === 0) {
            // another tab rotated a moment ago; the jar already holds its cookie
            await new Promise((r) => setTimeout(r, 350))
            continue
          }
          return false
        }
        return false
      }
      const ok =
        typeof navigator !== 'undefined' && navigator.locks
          ? await navigator.locks.request('esamithi-refresh', run)
          : await run()
      if (!ok) drop(state.status === 'authenticated' ? 'expired' : 'anonymous')
      return ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

// First thing on load: is there a live cookie for the remembered samithi?
export function ensureSession(): Promise<void> {
  if (state.status !== 'unknown') return Promise.resolve()
  const handoff = loadHandoff()
  if (handoff) {
    if (!ensurePromise) {
      ensurePromise = enterSupport(handoff)
        .then((ok) => {
          if (!ok) setState({ status: 'anonymous' })
        })
        .finally(() => {
          ensurePromise = null
        })
    }
    return ensurePromise
  }
  if (!state.samithi) {
    setState({ status: 'anonymous' })
    return Promise.resolve()
  }
  if (!ensurePromise) {
    ensurePromise = refresh()
      .then((ok) => {
        if (!ok) setState({ status: 'anonymous' })
      })
      .finally(() => {
        ensurePromise = null
      })
  }
  return ensurePromise
}

export async function loadMe(): Promise<SessionUser | null> {
  if (!accessToken) return null
  const res = await fetch(`${apiBase()}/auth/me`, { headers: authHeaders({ Authorization: `Bearer ${accessToken}` }) })
  if (!res.ok) return null
  const me = (await readJson(res)) as unknown as SessionUser & { samithi?: { slug: string; name: string | null } }
  const user: SessionUser = { id: me.id, username: me.username, full_name: me.full_name, role: me.role, must_change_password: me.must_change_password }
  setState({ user })
  return user
}

export async function signOut(all = false): Promise<void> {
  if (state.support) {
    const back = exitSupport()
    if (back) window.location.href = back
    return
  }
  try {
    await fetch(`${apiBase()}/auth/logout${all ? '?all=1' : ''}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: authHeaders(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    })
  } catch {
    /* offline: local state still clears */
  }
  drop('anonymous')
  channel?.postMessage({ type: 'signed-out' })
}

export function markExpired(): void {
  drop('expired')
}

// Authenticated fetch against the tenant API: attaches the token and samithi,
// refreshes once on 401 and retries, then surfaces the session as expired.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const attempt = async (): Promise<Response> => {
    const headers = new Headers(init.headers || {})
    headers.set('Accept', 'application/json')
    if (state.samithi) headers.set('X-Samithi', state.samithi.slug)
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    return fetch(`${apiBase()}${path}`, { ...init, headers, credentials: 'same-origin' })
  }
  if (!accessToken && state.status !== 'anonymous') await refresh()
  let res = await attempt()
  if (res.status === 401) {
    const ok = await refresh()
    if (!ok) {
      markExpired()
      throw new ApiError(401, 'Session expired', null, 'SESSION_EXPIRED')
    }
    res = await attempt()
    if (res.status === 401) {
      markExpired()
      throw new ApiError(401, 'Session expired', null, 'SESSION_EXPIRED')
    }
  }
  return res
}

interface MeResponse {
  id: number
  username: string
  full_name: string
  role: Role
  samithi?: { slug: string; name: string | null }
  support?: { actor: string; sid: string; expires_at: string | null } | null
}

// Adopt an operator support token: bearer only, no cookie, no rotation, no
// proactive refresh. The token is both proved and described by /auth/me — if
// the API does not call this a support session then we are not in one, however
// convincing the fragment looked.
export async function enterSupport(handoff: SupportHandoff): Promise<boolean> {
  accessToken = handoff.token
  sid = null
  if (refreshTimer) window.clearTimeout(refreshTimer)
  refreshTimer = null
  // X-Samithi chooses the tenant, so it has to be set before the first call
  setState({ samithi: { code: '', slug: handoff.slug, name: handoff.slug, api_url: apiBase() } })
  let me: MeResponse | null = null
  let answered = false
  try {
    const res = await fetch(`${apiBase()}/auth/me`, { headers: authHeaders({ Authorization: `Bearer ${handoff.token}` }) })
    answered = true
    if (res.ok) me = (await readJson(res)) as unknown as MeResponse
  } catch {
    /* the network, not the API: see below */
  }
  if (!me?.support?.sid) {
    accessToken = null
    // Forget the token only when the API actually answered. A blink of the
    // network is not an answer, and an operator whose hour is still running
    // should get their session back by reloading rather than by starting over.
    if (answered) clearHandoff()
    setState({ status: 'anonymous', user: null, samithi: loadSamithi(), expiresAt: 0, support: null })
    return false
  }
  const expiresAt = me.support.expires_at ? Date.parse(me.support.expires_at) : 0
  setState({
    status: 'authenticated',
    user: { id: me.id, username: me.username, full_name: me.full_name, role: me.role },
    samithi: { code: '', slug: me.samithi?.slug || handoff.slug, name: me.samithi?.name || handoff.slug, api_url: apiBase() },
    expiresAt,
    support: { actor: me.support.actor, sid: me.support.sid, expiresAt, returnTo: handoff.returnTo }
  })
  return true
}

// Leave support mode. Revoking the session needs super-admin credentials,
// which this app deliberately never holds, so the sid goes back to the console
// in the return URL and the console revokes it under the operator's own login.
// Returns where to send the operator, or null if we have nowhere to send them.
export function exitSupport(): string | null {
  const ctx = state.support
  clearHandoff()
  accessToken = null
  sid = null
  if (refreshTimer) window.clearTimeout(refreshTimer)
  refreshTimer = null
  setState({ status: 'anonymous', user: null, samithi: loadSamithi(), expiresAt: 0, support: null })
  // The console is a hash-routed app, so the sid rides as a search param on
  // its root route rather than as a bare fragment it would read as a path.
  return ctx?.returnTo && ctx.sid ? `${ctx.returnTo}/admin/#/?exit=${encodeURIComponent(ctx.sid)}` : null
}

// Cross-tab: another tab signed out (or in) — mirror it
channel?.addEventListener('message', (ev: MessageEvent<{ type?: string }>) => {
  if (ev.data?.type === 'signed-out') drop('anonymous')
  if (ev.data?.type === 'signed-in' && !accessToken) void refresh()
})

if (typeof window !== 'undefined') {
  for (const evt of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(evt, noteActivity, { passive: true })
  }
}
