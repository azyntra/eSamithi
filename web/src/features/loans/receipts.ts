import { formatCurrency } from '@/lib/format/currency'
import { formatDate, todayIso } from '@/lib/format/dates'
import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { loanPaymentReceiptNo, loanStatementNo } from '@/lib/print/numbers'
import { buildReceiptHtml, printLoanStatus } from '@/lib/print/receipt'
import type { LoanDetail, LoanPayment } from './types'

const pt = (k: TranslationKey, vars?: Record<string, string | number>) => translate(currentLang(), k, vars)

export function loanPaymentReceiptHtml(loan: LoanDetail, p: LoanPayment, societyName: string): string {
  const total = p.principal_paid + p.interest_paid + p.fines_paid
  return buildReceiptHtml({
    societyName: societyName || 'eSamithi',
    title: pt('rcpt.loanPaymentTitle'),
    receiptNo: loanPaymentReceiptNo(p.id),
    date: formatDate(p.date, currentLang()),
    rows: [
      [pt('rcpt.borrower'), loan.member_name || '—'],
      [pt('rcpt.loanRef'), `#${loan.id}`],
      ...(p.bill_no ? [[pt('rcpt.billNo'), p.bill_no] as [string, string]] : []),
      [pt('rcpt.appliedFine'), formatCurrency(p.fines_paid)],
      [pt('rcpt.appliedInterest'), formatCurrency(p.interest_paid)],
      [pt('rcpt.appliedPrincipal'), formatCurrency(p.principal_paid)]
    ],
    amountLabel: pt('rcpt.totalPaid'),
    amountValue: formatCurrency(total),
    footerNote: pt('rcpt.allocationNote')
  })
}

export function loanStatementHtml(loan: LoanDetail, societyName: string): string {
  const totalOwed = loan.principal_owed + loan.interest_owed + loan.fines_owed
  return buildReceiptHtml({
    societyName: societyName || 'eSamithi',
    title: pt('rcpt.loanStatementTitle'),
    receiptNo: loanStatementNo(loan.id),
    date: formatDate(todayIso(), currentLang()),
    rows: [
      [pt('rcpt.borrower'), loan.member_name || '—'],
      [pt('rcpt.nic'), loan.member_nic || '—'],
      [pt('rcpt.issuedOn'), formatDate(loan.date_issued, currentLang())],
      [pt('rcpt.originalPrincipal'), formatCurrency(loan.principal_amount)],
      [pt('rcpt.remainingPrincipal'), formatCurrency(loan.principal_owed)],
      [pt('rcpt.outstandingInterest'), formatCurrency(loan.interest_owed)],
      [pt('rcpt.outstandingFine'), formatCurrency(loan.fines_owed)],
      [pt('rcpt.status'), printLoanStatus(loan.status)]
    ],
    amountLabel: pt('rcpt.totalOutstanding'),
    amountValue: formatCurrency(totalOwed)
  })
}
