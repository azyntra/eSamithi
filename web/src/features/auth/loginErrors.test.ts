import { describe, expect, it } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { DirectoryError } from '@/lib/api/samithi'
import { loginErrorKey } from './loginErrors'

describe('login failures become messages a counter can act on', () => {
  it('separates a wrong password from a locked account', () => {
    expect(loginErrorKey(new ApiError(401, 'Invalid credentials')).key).toBe('login.invalid')
    const locked = loginErrorKey(new ApiError(423, 'Locked', { retry_after_seconds: 900 }))
    expect(locked.key).toBe('login.locked')
    expect(locked.vars).toEqual({ minutes: 15 })
  })

  it('tells the user plainly when their samithi server predates the web app', () => {
    // Production ran API 1.0.x for a while after app.esamithi.com went up, so
    // POST /auth/session answered 404. An unknown or suspended samithi is 403,
    // so 404 can only mean the endpoint is missing.
    expect(loginErrorKey(new ApiError(404, 'Not Found')).key).toBe('login.serverOutdated')
    expect(loginErrorKey(new ApiError(501, 'Not Implemented')).key).toBe('login.serverOutdated')
    expect(loginErrorKey(new ApiError(403, 'This samithi is suspended.')).key).toBe('login.suspended')
  })

  it('reports a lost connection as such, from either layer', () => {
    expect(loginErrorKey(new DirectoryError(0, 'network')).key).toBe('login.network')
    expect(loginErrorKey(new ApiError(0, 'offline')).key).toBe('login.network')
    expect(loginErrorKey(new TypeError('Failed to fetch')).key).toBe('login.network')
  })
})
