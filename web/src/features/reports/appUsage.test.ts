import { describe, expect, it } from 'vitest'
import { filterUsage, lastSeenLabel, versionLabel } from './appUsage'
import type { AppUsageMember } from './types'

const member = (over: Partial<AppUsageMember>): AppUsageMember => ({
  id: 1, society_id: 'S-1', full_name: 'Nimal', phone: null, status: 'active', enrolled: true,
  enrolled_at: null, first_seen_at: null, last_seen_at: null, platform: null, app_version: null,
  push_enabled: false, pin_locked: false, ...over
})

const t = (key: string, vars?: Record<string, string | number>) => (vars ? `${key}:${vars.n}` : key)
const NOW = '2026-11-11T10:00:00.000Z'

describe('filterUsage', () => {
  const list = [
    member({ id: 1, full_name: 'Sunil', status: 'not_enrolled', enrolled: false }),
    member({ id: 2, full_name: 'Amara', status: 'active', last_seen_at: '2026-11-10T08:00:00.000Z' }),
    member({ id: 3, full_name: null, society_id: 'S-77', status: 'online', last_seen_at: '2026-11-11T09:59:00.000Z', phone: '0771234567' }),
    member({ id: 4, full_name: 'Bandula', status: 'not_enrolled', enrolled: false })
  ]

  it('puts the most recently used first and never-used members last, by name', () => {
    expect(filterUsage(list, 'all', '').map((m) => m.id)).toEqual([3, 2, 4, 1])
  })

  it('narrows to one status', () => {
    expect(filterUsage(list, 'not_enrolled', '').map((m) => m.id)).toEqual([4, 1])
  })

  it('searches name, society ID and phone, and survives a nameless member', () => {
    expect(filterUsage(list, 'all', 'amar').map((m) => m.id)).toEqual([2])
    expect(filterUsage(list, 'all', 's-77').map((m) => m.id)).toEqual([3])
    expect(filterUsage(list, 'all', '07712').map((m) => m.id)).toEqual([3])
  })
})

describe('lastSeenLabel', () => {
  const label = (iso: string | null) => lastSeenLabel(iso, NOW, t as never, 'en')
  it('steps from minutes to hours to days', () => {
    expect(label(null)).toBe('reports.appNever')
    expect(label('2026-11-11T09:59:30.000Z')).toBe('reports.appJustNow')
    expect(label('2026-11-11T09:15:00.000Z')).toBe('reports.appMinAgo:45')
    expect(label('2026-11-11T04:00:00.000Z')).toBe('reports.appHoursAgo:6')
    expect(label('2026-11-01T10:00:00.000Z')).toBe('reports.appDaysAgo:10')
  })
  it('never shows a negative age when the server clock is behind', () => {
    expect(label('2026-11-11T10:00:05.000Z')).toBe('reports.appJustNow')
  })
})

describe('versionLabel', () => {
  it('joins what is known and dashes when nothing is', () => {
    expect(versionLabel({ platform: 'android', app_version: '1.4.0' })).toBe('Android · 1.4.0')
    expect(versionLabel({ platform: 'ios', app_version: null })).toBe('iOS')
    expect(versionLabel({ platform: null, app_version: null })).toBe('—')
  })
})
