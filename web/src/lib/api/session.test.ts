import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Exercise the client-side session manager against a fake fetch: refresh is
// single-flight, RACED is retried once, 401 on a business call triggers one
// refresh + retry, and a failed refresh marks the session expired.
describe('session manager', () => {
  const calls: string[] = []
  let refreshResponses: Array<() => Response>

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
  const token = (sid: string) => `h.${btoa(JSON.stringify({ id: 1, sid })).replace(/=+$/, '')}.s`

  beforeEach(() => {
    vi.resetModules()
    calls.length = 0
    refreshResponses = []
    localStorage.setItem('esamithi.web.samithi', JSON.stringify({ code: 'TST-0001', slug: 'test01', name: 'Test', api_url: 'http://x/api/v1' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url.replace(/^.*\/api\/v1/, ''))
        if (url.endsWith('/auth/refresh')) return (refreshResponses.shift() ?? (() => json(401, { error: 'x', code: 'INVALID' })))()
        if (url.endsWith('/auth/me')) return json(200, { id: 1, username: 'admin', full_name: 'Admin', role: 'admin' })
        if (url.endsWith('/members')) return json(200, [{ id: 1 }])
        if (url.endsWith('/needs-auth')) return json(401, { error: 'Invalid or expired token' })
        return json(404, { error: 'nf' })
      })
    )
    vi.stubGlobal('navigator', { ...navigator, locks: undefined, onLine: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('ensureSession refreshes once even when called concurrently, then loads /me', async () => {
    refreshResponses = [() => json(200, { access_token: token('fam1'), expires_in: 900 })]
    const s = await import('./session')
    await Promise.all([s.ensureSession(), s.ensureSession(), s.ensureSession()])
    expect(calls.filter((c) => c === '/auth/refresh')).toHaveLength(1)
    expect(s.getSessionState().status).toBe('authenticated')
    expect(s.getSessionState().user?.username).toBe('admin')
    expect(s.getSid()).toBe('fam1')
  })

  it('retries once after a RACED answer', async () => {
    refreshResponses = [() => json(401, { error: 'elsewhere', code: 'RACED' }), () => json(200, { access_token: token('fam2'), expires_in: 900 })]
    const s = await import('./session')
    await s.ensureSession()
    expect(calls.filter((c) => c === '/auth/refresh')).toHaveLength(2)
    expect(s.isAuthenticated()).toBe(true)
  })

  it('a 401 on a business call refreshes and retries; a second failure expires the session', async () => {
    refreshResponses = [
      () => json(200, { access_token: token('fam3'), expires_in: 900 }),
      () => json(200, { access_token: token('fam3'), expires_in: 900 }),
      () => json(401, { error: 'gone', code: 'REVOKED' })
    ]
    const s = await import('./session')
    await s.ensureSession()
    const ok = await s.apiFetch('/members')
    expect(ok.status).toBe(200)
    // endpoint that always 401s: one refresh + one retry, then expired
    await expect(s.apiFetch('/needs-auth')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    expect(calls.filter((c) => c === '/needs-auth')).toHaveLength(2)
    expect(s.getSessionState().status).toBe('expired')
    expect(s.getSessionState().user?.username).toBe('admin')
  })

  it('without a remembered samithi the session is anonymous and nothing is fetched', async () => {
    localStorage.removeItem('esamithi.web.samithi')
    const s = await import('./session')
    await s.ensureSession()
    expect(s.getSessionState().status).toBe('anonymous')
    expect(calls).toHaveLength(0)
  })
})
