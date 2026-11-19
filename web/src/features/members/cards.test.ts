import { describe, expect, it } from 'vitest'
import { buildCardsHtml, sheetCount } from './cards'

const member = (n: number, name: string | null = `Member ${n}`) => ({ id: n, society_id: `S-${String(n).padStart(3, '0')}`, full_name: name })

describe('membership QR cards', () => {
  it('puts the society name, member name, society ID and a QR on each card — and nothing else', async () => {
    const html = await buildCardsHtml([member(42, 'Nimal <Perera>')], 'Maranadhara Samithi')
    expect(html).toContain('Maranadhara Samithi')
    expect(html).toContain('Nimal &lt;Perera&gt;') // escaped, never raw HTML
    expect(html).toContain('S-042')
    expect((html.match(/<svg /g) ?? []).length).toBe(1)
    expect(html).not.toMatch(/NIC|phone/i)
  })

  it('prints a member with no name by society ID alone', async () => {
    const html = await buildCardsHtml([member(7, null)], 'Samithi')
    expect(html).toContain('S-007')
    expect(html).not.toContain('null')
  })

  it('lays out ten cards to a sheet and breaks the page between sheets', async () => {
    const html = await buildCardsHtml(Array.from({ length: 23 }, (_, i) => member(i + 1)), 'Samithi')
    expect((html.match(/<svg /g) ?? []).length).toBe(23)
    expect((html.match(/break-after:page/g) ?? []).length).toBe(2) // 3 sheets, no break after the last
    expect(sheetCount(23)).toBe(3)
    expect(sheetCount(10)).toBe(1)
    expect(sheetCount(0)).toBe(0)
  })
})
