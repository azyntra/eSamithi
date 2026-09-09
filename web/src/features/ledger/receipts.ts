import { formatCurrency } from '@/lib/format/currency'
import { formatDate } from '@/lib/format/dates'
import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { expenseVoucherNo, incomeReceiptNo } from '@/lib/print/numbers'
import { buildReceiptHtml, printPaymentMethod } from '@/lib/print/receipt'
import type { ExpenseTransaction, IncomeTransaction } from './types'

const pt = (k: TranslationKey, vars?: Record<string, string | number>) => translate(currentLang(), k, vars)

export function incomeReceiptHtml(tx: IncomeTransaction, societyName: string): string {
  return buildReceiptHtml({
    societyName: societyName || 'eSamithi',
    title: pt('rcpt.incomeTitle'),
    receiptNo: incomeReceiptNo(tx.id),
    date: formatDate(tx.date, currentLang()),
    rows: [
      [pt('rcpt.receivedFrom'), tx.payer_name || '—'],
      ...(tx.member_nic ? ([[pt('rcpt.nic'), tx.member_nic]] as Array<[string, string]>) : []),
      [pt('rcpt.incomeType'), tx.income_type_name || '—'],
      [pt('rcpt.paymentMethod'), printPaymentMethod(tx.payment_method)],
      [pt('rcpt.depositedTo'), tx.wallet_name || '—']
    ],
    amountLabel: pt('rcpt.amountReceived'),
    amountValue: formatCurrency(tx.amount),
    footerNote: tx.notes || undefined
  })
}

export function expenseVoucherHtml(tx: ExpenseTransaction, societyName: string): string {
  return buildReceiptHtml({
    societyName: societyName || 'eSamithi',
    title: pt('rcpt.expenseTitle'),
    receiptNo: expenseVoucherNo(tx.id, tx.voucher_no),
    date: formatDate(tx.date, currentLang()),
    rows: [
      [pt('rcpt.paidTo'), tx.recipient_name || '—'],
      ...(tx.member_nic ? ([[pt('rcpt.nic'), tx.member_nic]] as Array<[string, string]>) : []),
      [pt('rcpt.expenseType'), tx.expense_type_name || '—'],
      [pt('rcpt.paymentMethod'), printPaymentMethod(tx.payment_method)],
      [pt('rcpt.paidFrom'), tx.wallet_name || '—']
    ],
    amountLabel: pt('rcpt.amountPaid'),
    amountValue: formatCurrency(tx.amount),
    footerNote: tx.notes || undefined
  })
}

export const PAYMENT_METHOD_KEY: Record<string, TranslationKey> = { Cash: 'lform.pmCash', 'Bank Transfer': 'lform.pmBankTransfer', Cheque: 'lform.pmCheque' }
export const SOURCE_KEY: Record<string, TranslationKey> = {
  'Building Rental': 'src.buildingRental',
  'Electricity Bill Reimbursement': 'src.electricityReimbursement',
  'Water Bill Reimbursement': 'src.waterReimbursement',
  'Damage Compensation': 'src.damageCompensation',
  'Other Building-related Charges': 'src.otherBuilding',
  'Asset Rental': 'src.assetRental',
  'Asset Sale': 'src.assetSale',
  'Electricity Bill': 'src.electricityBill',
  'Water Bill': 'src.waterBill',
  'Telephone Bill': 'src.telephoneBill',
  'Internet Bill': 'src.internetBill',
  'Building Maintenance': 'src.buildingMaintenance',
  'Operational Expenses': 'src.operationalExpenses'
}
