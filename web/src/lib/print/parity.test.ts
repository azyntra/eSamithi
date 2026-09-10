import { describe, expect, it, beforeEach } from 'vitest'
// The desktop implementation is the reference: printed paper must not change
// when a society moves to the web (requirements FR-12.1). This imports the
// frozen renderer's builder directly and compares it with ours.
import { buildReceiptHtml as desktopBuild, printPaymentMethod as desktopMethod } from '../../../../src/renderer/src/utils/print'
import { buildReceiptHtml, printPaymentMethod } from './receipt'
import { expenseVoucherNo, incomeReceiptNo, loanPaymentReceiptNo, loanStatementNo } from './numbers'

const sample = {
  societyName: 'මරණාධාර සමිතිය',
  title: 'Income Receipt',
  receiptNo: 'INC-00042',
  date: '05 Jan 2026',
  rows: [
    ['Received From', 'Nimal Perera'],
    ['NIC', '901234567V'],
    ['Income Type', 'Membership Fee & <Fine>'],
    ['Payment Method', 'Cash'],
    ['Deposited To', 'Petty Cash']
  ] as Array<[string, string]>,
  amountLabel: 'Amount Received',
  amountValue: 'Rs. 12,500.00',
  footerNote: 'Receipt "book" 12 & 13'
}

describe('receipt parity with the desktop', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders byte-identical HTML in English', () => {
    localStorage.setItem('esamithi-lang', 'en')
    expect(buildReceiptHtml(sample)).toBe(desktopBuild(sample))
  })

  it('renders byte-identical HTML in Sinhala', () => {
    localStorage.setItem('esamithi-lang', 'si')
    expect(buildReceiptHtml(sample)).toBe(desktopBuild(sample))
  })

  it('escapes the same way and keeps the signature block', () => {
    localStorage.setItem('esamithi-lang', 'en')
    const html = buildReceiptHtml(sample)
    expect(html).toContain('Membership Fee &amp; &lt;Fine&gt;')
    expect(html).toContain('Treasurer')
    expect(html).toBe(desktopBuild(sample))
  })

  it('translates payment methods exactly like the desktop', () => {
    for (const lang of ['en', 'si']) {
      localStorage.setItem('esamithi-lang', lang)
      for (const m of ['Cash', 'Bank Transfer', 'Cheque', 'Unknown', null]) {
        expect(printPaymentMethod(m)).toBe(desktopMethod(m))
      }
    }
  })

  it('keeps the receipt numbering series unchanged', () => {
    expect(incomeReceiptNo(42)).toBe('INC-00042')
    expect(incomeReceiptNo(1)).toBe('INC-00001')
    expect(incomeReceiptNo(123456)).toBe('INC-123456')
    expect(expenseVoucherNo(7, null)).toBe('EXP-00007')
    expect(expenseVoucherNo(7, 'VCH/2026/9')).toBe('VCH/2026/9')
    expect(loanPaymentReceiptNo(9)).toBe('LNP-00009')
    expect(loanStatementNo(9)).toBe('LN-00009')
  })
})
