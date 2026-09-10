import { describe, expect, it } from 'vitest'
import { addMonths, fdDisplayStatus, isNearingMaturity } from './fd'

describe('fixed deposit dates', () => {
  it('adds months with month-end clamping and no timezone drift', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-15', 12)).toBe('2027-03-15')
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(addMonths('bad', 3)).toBe('')
  })
  it('flags maturity within 30 days and shows matured after the date', () => {
    const now = new Date(2026, 8, 10)
    expect(isNearingMaturity('2026-09-25', now)).toBe(true)
    expect(isNearingMaturity('2026-10-10', now)).toBe(true)
    expect(isNearingMaturity('2026-10-11', now)).toBe(false)
    expect(isNearingMaturity('2026-09-09', now)).toBe(false)
    expect(fdDisplayStatus({ status: 'Active', maturity_date: '2026-09-09' }, now)).toBe('Matured')
    expect(fdDisplayStatus({ status: 'Active', maturity_date: '2026-09-10' }, now)).toBe('Active')
    expect(fdDisplayStatus({ status: 'Withdrawn', maturity_date: '2026-01-01' }, now)).toBe('Withdrawn')
  })
})
