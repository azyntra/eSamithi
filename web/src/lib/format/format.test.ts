import { describe, expect, it } from 'vitest'
import { formatCurrency, formatCurrencyCompact, parseCurrency } from './currency'
import { formatDate } from './dates'

describe('formatters', () => {
  it('formats cents as rupees with two decimals', () => {
    expect(formatCurrency(1250000)).toBe('Rs. 12,500.00')
    expect(formatCurrency(0)).toBe('Rs. 0.00')
    expect(formatCurrency(undefined)).toBe('Rs. 0.00')
  })
  it('compacts large amounts for KPI cards', () => {
    expect(formatCurrencyCompact(125_000_000)).toBe('Rs. 1.25M')
    expect(formatCurrencyCompact(35_000_000)).toBe('Rs. 350K')
    expect(formatCurrencyCompact(999_99)).toBe('Rs. 999.99')
  })
  it('parses typed rupees back to cents', () => {
    expect(parseCurrency('12,500.50')).toBe(1250050)
    expect(parseCurrency('Rs. 1,000')).toBe(100000)
    expect(parseCurrency('abc')).toBe(0)
  })
  it('never shifts a date by a day for UTC-midnight timestamps', () => {
    expect(formatDate('2026-01-05T00:00:00.000Z', 'en')).toBe('05 Jan 2026')
    expect(formatDate('2026-04-12', 'si')).toBe('12 අප්‍රේ 2026')
    expect(formatDate(null)).toBe('—')
  })
})
