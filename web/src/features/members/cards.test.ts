import { describe, expect, it } from 'vitest'
import { buildCardsHtml, formatPhone, nameSize, numberSize, sheetCount, hasCardName } from './cards'

const member = (n: number, name: string | null = `Member ${n}`) => ({ id: n, society_id: `S-${String(n).padStart(3, '0')}`, full_name: name })

describe('membership QR cards', () => {
  it('puts the society name, full name, membership no., NIC, phone and a QR on each card', async () => {
    const html = await buildCardsHtml([{ ...member(42, 'Nimal <Perera>'), nic: '806593052V', phone: '0701366809' }], 'Maranadhara Samithi')
    expect(html).toContain('Maranadhara Samithi')
    expect(html).toContain('Nimal &lt;Perera&gt;') // escaped, never raw HTML
    expect(html).toContain('S-042')
    expect(html).toContain('806593052V')
    expect(html).toContain('070 136 6809')
    expect((html.match(/shape-rendering="crispEdges"/g) ?? []).length).toBe(1)
    expect(html).not.toMatch(/joining|ලියාපදිංචි/i)
  })

  it('never cuts a long name to one line — it wraps and steps down a size', () => {
    expect(nameSize('Nimal Perera')).toBe(11.5)
    expect(nameSize('Matiwala Kubure Gedara Somapala')).toBe(10.5)
    expect(nameSize('Matiwala Kubure Gedara Somapala Bandara Wijesinghe')).toBe(9.5)
    expect(nameSize('x'.repeat(80))).toBe(8)
    expect(numberSize('217')).toBe(16)
    expect(numberSize('MKG/2024/0123')).toBe(10)
  })

  it('groups a Sri Lankan mobile number and leaves other numbers as entered', () => {
    expect(formatPhone('0701366809')).toBe('070 136 6809')
    expect(formatPhone('070-136 6809')).toBe('070 136 6809')
    expect(formatPhone('+94 70 136 6809')).toBe('+94 70 136 6809')
  })

  it('leaves out NIC and phone rows when they are missing', async () => {
    const html = await buildCardsHtml([member(9)], 'Samithi')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })

  it('prints a member with no name by society ID alone', async () => {
    const html = await buildCardsHtml([member(7, null)], 'Samithi')
    expect(html).toContain('S-007')
    expect(html).not.toContain('null')
  })

  it('lays out ten cards to a sheet and breaks the page between sheets', async () => {
    const html = await buildCardsHtml(Array.from({ length: 23 }, (_, i) => member(i + 1)), 'Samithi')
    expect((html.match(/shape-rendering="crispEdges"/g) ?? []).length).toBe(23)
    expect((html.match(/break-after:page/g) ?? []).length).toBe(2) // 3 sheets, no break after the last
    expect(sheetCount(23)).toBe(3)
    expect(sheetCount(10)).toBe(1)
    expect(sheetCount(0)).toBe(0)
  })
})

describe('hasCardName', () => {
  it('skips members whose name is missing, empty or only spaces', () => {
    expect(hasCardName({ full_name: 'K. Perera' })).toBe(true)
    expect(hasCardName({ full_name: 'සුනිල්' })).toBe(true)
    expect(hasCardName({ full_name: null })).toBe(false)
    expect(hasCardName({ full_name: '' })).toBe(false)
    expect(hasCardName({ full_name: '   ' })).toBe(false)
  })
})
