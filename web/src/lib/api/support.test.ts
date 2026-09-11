import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The operator handoff: a one-time fragment the console writes and this app
// has to bank, clean away, and then largely disbelieve.
const pack = (o: unknown): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(o))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return encodeURIComponent(btoa(bin))
}

const TOKEN = 'h.eyJpZCI6MCwic2FtIjoic2FtaXRoaTAxIn0.sig'

describe('support handoff', () => {
  beforeEach(() => {
    vi.resetModules()
    sessionStorage.clear()
    history.replaceState(null, '', '/support')
  })
  afterEach(() => {
    history.replaceState(null, '', '/')
  })

  it('decodes a percent-encoded payload, stores it and wipes the fragment', async () => {
    const packed = pack({ token: TOKEN, slug: 'samithi01', name: 'මරණාධාර සමිතිය', console: 'https://console.esamithi.com' })
    // The padding alone guarantees the layer that used to break this
    expect(packed).toContain('%3D')
    window.location.hash = `#s=${packed}`
    const { consumeHandoff, loadHandoff } = await import('./support')

    const got = consumeHandoff()
    expect(got).toEqual({ token: TOKEN, slug: 'samithi01', returnTo: 'https://console.esamithi.com' })
    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/support')
    // a reload of the same tab still has it
    vi.resetModules()
    const fresh = await import('./support')
    expect(fresh.loadHandoff()?.token).toBe(TOKEN)
    expect(loadHandoff()?.token).toBe(TOKEN)
  })

  it('keeps only the origin of the console it was given, and refuses a plain-http one', async () => {
    window.location.hash = `#s=${pack({ token: TOKEN, slug: 's1', console: 'https://console.esamithi.com/admin/samithis?x=1#y' })}`
    const { consumeHandoff } = await import('./support')
    expect(consumeHandoff()?.returnTo).toBe('https://console.esamithi.com')

    vi.resetModules()
    sessionStorage.clear()
    window.location.hash = `#s=${pack({ token: TOKEN, slug: 's1', console: 'http://evil.example' })}`
    const again = await import('./support')
    expect(again.consumeHandoff()?.returnTo).toBeNull()
  })

  it('ignores a malformed fragment but still cleans the address bar', async () => {
    window.location.hash = '#s=not-base64!!'
    const { consumeHandoff } = await import('./support')
    expect(consumeHandoff()).toBeNull()
    expect(window.location.hash).toBe('')
  })

  it('needs both a token and a slug', async () => {
    window.location.hash = `#s=${pack({ token: TOKEN })}`
    const { consumeHandoff } = await import('./support')
    expect(consumeHandoff()).toBeNull()
  })
})

describe('support mode session', () => {
  const calls: string[] = []
  let me: () => Response

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const ok = (extra: Record<string, unknown> = {}) =>
    json(200, {
      id: 0,
      username: 'eSamithi Support (ops@esamithi.lk)',
      full_name: 'eSamithi Support',
      role: 'admin',
      samithi: { slug: 'samithi01', name: 'Maranadhara Samithiya' },
      support: { actor: 'sa:3', sid: 'abc123', expires_at: new Date(Date.now() + 60 * 60_000).toISOString() },
      ...extra
    })

  beforeEach(() => {
    vi.resetModules()
    calls.length = 0
    sessionStorage.clear()
    localStorage.clear()
    me = ok
    sessionStorage.setItem('esamithi.web.support', JSON.stringify({ token: TOKEN, slug: 'samithi01', returnTo: 'https://console.esamithi.com' }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        calls.push(url.replace(/^.*\/api\/v1/, ''))
        if (url.endsWith('/auth/me')) return me()
        if (url.endsWith('/gone')) return json(401, { error: 'Invalid or expired token' })
        return json(200, [{ id: 1 }])
      })
    )
    vi.stubGlobal('navigator', { ...navigator, locks: undefined, onLine: true })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adopts the token from /auth/me and never asks for a refresh cookie', async () => {
    const s = await import('./session')
    await s.ensureSession()
    expect(calls).toEqual(['/auth/me'])
    expect(s.isSupportMode()).toBe(true)
    expect(s.getSessionState().status).toBe('authenticated')
    expect(s.getSessionState().samithi?.name).toBe('Maranadhara Samithiya')
    expect(s.getSessionState().support).toMatchObject({ actor: 'sa:3', sid: 'abc123', returnTo: 'https://console.esamithi.com' })
    expect(await s.refresh()).toBe(false)
    expect(calls.filter((c) => c === '/auth/refresh')).toHaveLength(0)
  })

  it('refuses a token the API does not call a support session, and forgets it', async () => {
    me = () => ok({ support: null })
    const s = await import('./session')
    await s.ensureSession()
    expect(s.isSupportMode()).toBe(false)
    expect(s.getSessionState().status).toBe('anonymous')
    expect(sessionStorage.getItem('esamithi.web.support')).toBeNull()
  })

  it('keeps the token when the network blinked, because that is not the API saying no', async () => {
    me = () => {
      throw new Error('offline')
    }
    const s = await import('./session')
    await s.ensureSession()
    expect(s.isSupportMode()).toBe(false)
    // still there for the reload that follows
    expect(JSON.parse(sessionStorage.getItem('esamithi.web.support')!).token).toBe(TOKEN)
  })

  it('a 401 ends the session outright instead of trying to renew it', async () => {
    const s = await import('./session')
    await s.ensureSession()
    await expect(s.apiFetch('/gone')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' })
    // one attempt, no refresh, no retry
    expect(calls.filter((c) => c === '/gone')).toHaveLength(1)
    expect(calls.filter((c) => c === '/auth/refresh')).toHaveLength(0)
    expect(s.getSessionState().status).toBe('expired')
    // the banner still knows whose session it was
    expect(s.getSessionState().support?.sid).toBe('abc123')
  })

  it('exit hands the sid back to the console and leaves nothing behind', async () => {
    const s = await import('./session')
    await s.ensureSession()
    expect(s.exitSupport()).toBe('https://console.esamithi.com/admin/#/?exit=abc123')
    expect(s.isSupportMode()).toBe(false)
    expect(s.getSessionState().status).toBe('anonymous')
    expect(s.getAccessToken()).toBeNull()
    expect(sessionStorage.getItem('esamithi.web.support')).toBeNull()
  })

  it('with no console to return to, exit says so rather than inventing one', async () => {
    sessionStorage.setItem('esamithi.web.support', JSON.stringify({ token: TOKEN, slug: 'samithi01', returnTo: null }))
    const s = await import('./session')
    await s.ensureSession()
    expect(s.exitSupport()).toBeNull()
  })
})
