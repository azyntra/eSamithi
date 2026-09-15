import { describe, expect, it } from 'vitest'
import { compareMembers, fold, matchesMember, memberLabel, memberSublabel } from './members'

// Shaped like production: a member entered from paper with only an ID.
const NAMELESS = { id: 33, society_id: '33', nic: null, full_name: null }
const NAMED = { id: 1, society_id: '01', nic: '480320085V', full_name: 'Disanayaka Mudiyanselage Appuhami' }

describe('members with missing fields', () => {
  it('folds null and undefined to an empty string instead of throwing', () => {
    expect(fold(null)).toBe('')
    expect(fold(undefined)).toBe('')
    expect(fold('  Nimal ')).toBe('nimal')
  })

  it('is still found by ID when the name is missing, and never throws on a keystroke', () => {
    expect(() => matchesMember(NAMELESS, 'a')).not.toThrow()
    expect(matchesMember(NAMELESS, '33')).toBe(true)
    expect(matchesMember(NAMELESS, 'appu')).toBe(false)
    expect(matchesMember(NAMED, 'appu')).toBe(true)
    expect(matchesMember(NAMED, '4803')).toBe(true)
    expect(matchesMember(NAMELESS, '')).toBe(true)
  })

  it('labels a nameless record with the caller’s word rather than "null"', () => {
    expect(memberLabel(NAMELESS, 'Unnamed member')).toBe('Unnamed member')
    expect(memberLabel({ full_name: '   ' }, 'Unnamed member')).toBe('Unnamed member')
    expect(memberLabel(NAMED, 'Unnamed member')).toBe(NAMED.full_name)
    expect(memberSublabel(NAMELESS)).toBe('33')
  })

  it('sorts named members first, nameless ones after them by ID', () => {
    const rows = [NAMELESS, { id: 115, society_id: '115', full_name: null }, NAMED, { id: 2, society_id: '02', full_name: 'Bandara' }]
    expect(rows.sort(compareMembers).map((m) => m.society_id)).toEqual(['02', '01', '33', '115'])
  })
})
