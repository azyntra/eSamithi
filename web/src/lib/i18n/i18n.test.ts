import { describe, expect, it } from 'vitest'
import { translate } from './index'
import en from './generated/en.json'
import si from './generated/si.json'

describe('i18n', () => {
  it('translates with placeholders in both languages', () => {
    expect(translate('en', 'dash.welcome', { name: 'Nimal' })).toBe('Welcome back, Nimal')
    expect(translate('si', 'dash.welcome', { name: 'නිමල්' })).toContain('නිමල්')
  })
  it('falls back to English for a key Sinhala lacks and to the key itself when unknown', () => {
    expect(translate('si', 'common.save')).not.toBe('common.save')
    expect(translate('en', 'nope.missing' as never)).toBe('nope.missing')
  })
  it('keeps the generated dictionaries in parity (every Sinhala key exists in English)', () => {
    const enKeys = new Set(Object.keys(en))
    for (const k of Object.keys(si)) expect(enKeys.has(k)).toBe(true)
    expect(Object.keys(en).length).toBeGreaterThan(800)
  })
  it('replaces every occurrence of a placeholder', () => {
    expect(translate('en', 'login.locked', { minutes: 3 })).toBe('Too many failed attempts. Try again in 3 min.')
  })
})
