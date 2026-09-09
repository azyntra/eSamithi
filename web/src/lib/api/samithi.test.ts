import { describe, expect, it } from 'vitest'
import { apiOriginOf, appUrlFor, isServedHere, loadSamithi, saveSamithi, type SamithiContext } from './samithi'

const ctx = (api_url: string, extra: Partial<SamithiContext> = {}): SamithiContext => ({ code: 'SAM-4217', slug: 'samithi01', name: 'Maranadhara', api_url, ...extra })

describe('samithi context', () => {
  it('derives the API origin and maps it to the app host', () => {
    expect(apiOriginOf('https://api.esamithi.com/api/v1')).toBe('https://api.esamithi.com')
    expect(appUrlFor(ctx('https://api.esamithi.com/api/v1'))).toBe('https://app.esamithi.com/')
    expect(appUrlFor(ctx('http://212.227.103.150/api/v1'))).toBe('https://console.esamithi.com/app/')
    expect(appUrlFor(ctx('http://10.0.0.1/api/v1', { app_url: 'https://other.example/app/' }))).toBe('https://other.example/app/')
    expect(appUrlFor(ctx('http://10.0.0.1/api/v1'))).toBeNull()
  })
  it('accepts any origin in dev (VITE_API_ORIGINS empty)', () => {
    expect(isServedHere(ctx('http://212.227.103.150/api/v1'))).toBe(true)
  })
  it('remembers and forgets the samithi on this device', () => {
    expect(loadSamithi()).toBeNull()
    saveSamithi(ctx('https://api.esamithi.com/api/v1'))
    expect(loadSamithi()?.slug).toBe('samithi01')
  })
})
