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
  const rowsHtml = data.rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:6px 0;color:#555;font-size:12px;">${esc(label)}</td>
        <td style="padding:6px 0;text-align:right;font-weight:600;font-size:12px;">${esc(value)}</td>
      </tr>`
    )
    .join('')

  return `
    <div style="max-width:420px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px;border:1px solid #ccc;">
      <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:800;">${esc(data.societyName)}</div>
        <div style="font-size:13px;margin-top:4px;">${esc(data.title)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:6px 0;color:#555;font-size:12px;">Receipt No.</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;font-size:12px;">${esc(data.receiptNo)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#555;font-size:12px;">Date</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;font-size:12px;">${esc(data.date)}</td>
        </tr>
        ${rowsHtml}
      </table>
      <div style="border-top:1px dashed #999;margin-top:10px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:13px;font-weight:700;">${esc(data.amountLabel)}</span>
        <span style="font-size:18px;font-weight:800;">${esc(data.amountValue)}</span>
      </div>
      ${data.footerNote ? `<div style="margin-top:10px;font-size:11px;color:#555;">${esc(data.footerNote)}</div>` : ''}
      <div style="margin-top:28px;display:flex;justify-content:space-between;font-size:11px;color:#555;">
        <span>____________________<br/>Treasurer</span>
        <span>____________________<br/>Received By</span>
      </div>
    </div>
  `
}
