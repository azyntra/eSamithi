import { currentLang, MONTHS_SHORT, translate } from '../i18n'
import type { TranslationKey } from '../i18n/en'

// Printing builds raw HTML outside React, so it can't use the useT() hook.
// It reads the persisted language directly instead — same source of truth as
// the provider, so paper always follows the app's language toggle.
function pt(key: TranslationKey, vars?: Record<string, string | number>): string {
  return translate(currentLang(), key, vars)
}

// Print a standalone receipt without printing the page behind it.
// Renders the receipt HTML into a temporary .printable-receipt element,
// flags the body so print CSS hides the app, prints, then cleans up.
export function printReceipt(receiptHtml: string): void {
  const holder = document.createElement('div')
  holder.className = 'printable-receipt'
  holder.innerHTML = receiptHtml
  document.body.appendChild(holder)
  document.body.classList.add('receipt-print-mode')

  const cleanup = (): void => {
    document.body.classList.remove('receipt-print-mode')
    holder.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  window.print()

  // Safety net in case afterprint doesn't fire (e.g. print dialog cancelled fast)
  setTimeout(cleanup, 2000)
}

function esc(s: string | number | null | undefined): string {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// "2026-01-05" / Date → "05 Jan 2026" or "05 ජන 2026".
// Parses the leading YYYY-MM-DD of an ISO string rather than constructing a
// Date, so a UTC-midnight timestamp never prints as the previous day.
export function formatPrintDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const months = MONTHS_SHORT[currentLang()]
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—'
    return `${String(value.getDate()).padStart(2, '0')} ${months[value.getMonth()]} ${value.getFullYear()}`
  }
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1]}`
  const d = new Date(String(value))
  if (Number.isNaN(d.getTime())) return String(value)
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`
}

// Payment methods and loan statuses are stored as English enums. Print them in
// the active language; anything unrecognised falls through unchanged.
const PAYMENT_METHOD_KEYS: Record<string, TranslationKey> = {
  Cash: 'rcpt.pmCash',
  'Bank Transfer': 'rcpt.pmBankTransfer',
  Cheque: 'rcpt.pmCheque'
}
const LOAN_STATUS_KEYS: Record<string, TranslationKey> = {
  Active: 'rcpt.stActive',
  Overdue: 'rcpt.stOverdue',
  Paid: 'rcpt.stPaid',
  Defaulted: 'rcpt.stDefaulted',
  Void: 'rcpt.stVoid',
  Voided: 'rcpt.stVoid'
}

export function printPaymentMethod(method: string | null | undefined): string {
  if (!method) return '—'
  const key = PAYMENT_METHOD_KEYS[method]
  return key ? pt(key) : method
}

export function printLoanStatus(status: string | null | undefined): string {
  if (!status) return '—'
  const key = LOAN_STATUS_KEYS[status]
  return key ? pt(key) : status
}

interface ReceiptData {
  societyName: string
  title: string
  receiptNo: string
  date: string
  rows: Array<[string, string]>
  amountLabel: string
  amountValue: string
  footerNote?: string
}

export function buildReceiptHtml(data: ReceiptData): string {
  // Sinhala first in the stack: Arial has no Sinhala glyphs, so the old
  // hardcoded Arial silently fell back to whatever the OS picked.
  const fontStack = `'Inter','Noto Sans Sinhala',Arial,Helvetica,sans-serif`
  const labelCell = 'padding:6px 0;color:#555;font-size:12px;border:0;'
  const valueCell = 'padding:6px 0;text-align:right;font-weight:600;font-size:12px;border:0;'

  const rowsHtml = data.rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="${labelCell}">${esc(label)}</td>
        <td style="${valueCell}">${esc(value)}</td>
      </tr>`
    )
    .join('')

  return `
    <div style="max-width:420px;margin:0 auto;font-family:${fontStack};color:#111;padding:24px;border:1px solid #ccc;">
      <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;">${esc(data.societyName)}</div>
        <div style="font-size:13px;margin-top:4px;">${esc(data.title)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="${labelCell}">${esc(pt('rcpt.receiptNo'))}</td>
          <td style="${valueCell}">${esc(data.receiptNo)}</td>
        </tr>
        <tr>
          <td style="${labelCell}">${esc(pt('rcpt.date'))}</td>
          <td style="${valueCell}">${esc(data.date)}</td>
        </tr>
        ${rowsHtml}
      </table>
      <div style="border-top:1px dashed #999;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:700;">${esc(data.amountLabel)}</span>
        <span style="font-size:18px;font-weight:800;">${esc(data.amountValue)}</span>
      </div>
      ${data.footerNote ? `<div style="margin-top:10px;font-size:11px;color:#555;">${esc(data.footerNote)}</div>` : ''}
      <div style="margin-top:28px;display:flex;justify-content:space-between;font-size:11px;color:#555;">
        <span>____________________<br/>${esc(pt('rcpt.treasurer'))}</span>
        <span>____________________<br/>${esc(pt('rcpt.receivedBy'))}</span>
      </div>
    </div>
  `
}
