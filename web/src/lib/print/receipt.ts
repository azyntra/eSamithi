import { currentLang, translate, type TranslationKey } from '@/lib/i18n'

// Ported verbatim from the desktop's utils/print.ts so printed paper matches
// what societies already file. Print templates are plain HTML strings so the
// same builder serves the print iframe and the preview.
const pt = (key: TranslationKey, vars?: Record<string, string | number>): string => translate(currentLang(), key, vars)

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const PAYMENT_METHOD_KEYS: Record<string, TranslationKey> = { Cash: 'rcpt.pmCash', 'Bank Transfer': 'rcpt.pmBankTransfer', Cheque: 'rcpt.pmCheque' }
const LOAN_STATUS_KEYS: Record<string, TranslationKey> = { Active: 'rcpt.stActive', Overdue: 'rcpt.stOverdue', Paid: 'rcpt.stPaid', Defaulted: 'rcpt.stDefaulted', Void: 'rcpt.stVoid', Voided: 'rcpt.stVoid' }

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

export interface ReceiptData {
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
