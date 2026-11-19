import { describe, expect, it } from 'vitest'
import { qrMatrix, qrSvg } from './qr'

describe('qr', () => {
  it('builds a version-1 code for a short society ID, with the three finder patterns', async () => {
    const m = await qrMatrix('S-042')
    expect(m.size).toBe(21)
    // Finder patterns: top-left, top-right, bottom-left corners are dark,
    // and the bottom-right corner area has none
    expect(m.dark(0, 0)).toBe(true)
    expect(m.dark(0, m.size - 1)).toBe(true)
    expect(m.dark(m.size - 1, 0)).toBe(true)
    expect(m.dark(3, 3)).toBe(true) // finder centre
    expect(m.dark(1, 1)).toBe(false) // finder inner ring
  })

  it('encodes different IDs differently and the same ID identically', async () => {
    const svg = async (s: string) => qrSvg(await qrMatrix(s), { sizeMm: 30 })
    expect(await svg('TEST-001')).toBe(await svg('TEST-001'))
    expect(await svg('TEST-001')).not.toBe(await svg('TEST-002'))
  })

  it('draws a four-module quiet zone and a physical size in millimetres', async () => {
    const svg = qrSvg(await qrMatrix('02'), { sizeMm: 34 })
    expect(svg).toContain('viewBox="0 0 29 29"') // 21 + 4 + 4
    expect(svg).toContain('width="34mm"')
    expect(svg).toContain('<rect width="29" height="29" fill="#fff"/>')
    // Nothing is drawn inside the quiet zone: every run starts at x ≥ 4, y ≥ 4
    const starts = [...svg.matchAll(/M(\d+) (\d+)h/g)].map((x) => [Number(x[1]), Number(x[2])])
    expect(starts.length).toBeGreaterThan(20)
    expect(starts.every(([x, y]) => x! >= 4 && y! >= 4 && x! < 25 && y! < 25)).toBe(true)
  })

  it('grows for a longer ID instead of failing', async () => {
    const m = await qrMatrix('MARANADHARA-SAMITHI-MEMBER-000123456')
    expect(m.size).toBeGreaterThan(21)
  })
})
