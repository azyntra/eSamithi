import { describe, expect, it } from 'vitest'
import { balanceOf, exposureOf, headroomOf, isOpen, nextChargePreview, type Loan } from './types'

const loan = (over: Partial<Loan>): Loan => ({
  id: 1, member_id: 7, principal_amount: 100_000_00, principal_owed: 0, interest_owed: 0, fines_owed: 0,
  purpose: null, date_issued: '2026-01-05', status: 'Active', is_migrated: 0, last_accrual_date: null,
  disbursement_wallet_id: 1, created_at: '2026-01-05', ...over
})

describe('loan rules mirrored from the server', () => {
  it('counts only open loans towards exposure, and only principal', () => {
    const loans = [
      loan({ id: 1, principal_owed: 20_000_00, interest_owed: 5_000_00, fines_owed: 1_000_00, status: 'Active' }),
      loan({ id: 2, principal_owed: 10_000_00, status: 'Overdue' }),
      loan({ id: 3, principal_owed: 50_000_00, status: 'Paid' }),
      loan({ id: 4, principal_owed: 90_000_00, status: 'Defaulted' }),
      loan({ id: 5, member_id: 8, principal_owed: 70_000_00, status: 'Active' })
    ]
    expect(exposureOf(loans, 7)).toBe(30_000_00)
    expect(exposureOf(loans, null)).toBe(0)
    expect(headroomOf(loans, 7, 100_000_00)).toBe(70_000_00)
  })

  it('treats a zero limit as no cap at all', () => {
    const loans = [loan({ principal_owed: 20_000_00 })]
    expect(headroomOf(loans, 7, 0)).toBeNull()
  })

  it('reports negative headroom when a migrated loan already exceeds the limit', () => {
    const loans = [loan({ principal_owed: 150_000_00, is_migrated: 1 })]
    expect(headroomOf(loans, 7, 100_000_00)).toBe(-50_000_00)
  })

  it('sums the balance and recognises open loans', () => {
    const l = loan({ principal_owed: 1000, interest_owed: 250, fines_owed: 75 })
    expect(balanceOf(l)).toBe(1325)
    expect(isOpen(l)).toBe(true)
    expect(isOpen({ status: 'Paid' })).toBe(false)
    expect(isOpen({ status: 'Defaulted' })).toBe(false)
  })

  it('previews the next interest charge on the same day-of-month, clamped', () => {
    expect(nextChargePreview('2026-01-31', 100_000_00, 2)).toEqual({ date: '2026-02-28', amount: 2_000_00 })
    expect(nextChargePreview('2026-12-15', 50_000_00, 1.5)).toEqual({ date: '2027-01-15', amount: 750_00 })
    expect(nextChargePreview('2026-03-10', 0, 2)).toBeNull()
    expect(nextChargePreview('2026-03-10', 100_00, 0)).toBeNull()
    expect(nextChargePreview('', 100_00, 2)).toBeNull()
  })
})
