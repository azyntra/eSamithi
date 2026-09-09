import interRegular from '@/assets/fonts/Inter-Regular.woff2?url'
import interSemiBold from '@/assets/fonts/Inter-SemiBold.woff2?url'
import interBold from '@/assets/fonts/Inter-Bold.woff2?url'
import sinhalaRegular from '@/assets/fonts/NotoSansSinhala-Regular.woff2?url'
import sinhalaSemiBold from '@/assets/fonts/NotoSansSinhala-SemiBold.woff2?url'
import sinhalaBold from '@/assets/fonts/NotoSansSinhala-Bold.woff2?url'

// A complete, self-contained document for a receipt/voucher/statement:
// always light, bundled fonts (so Sinhala shapes identically everywhere),
// A4-friendly margins. Used by both the preview iframe and printing.
export function printDocument(bodyHtml: string, title = 'eSamithi', lang = 'en'): string {
  const face = (family: string, url: string, weight: number) => `@font-face{font-family:'${family}';src:url('${url}') format('woff2');font-weight:${weight};font-display:block}`
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>
${face('Inter', interRegular, 400)}${face('Inter', interSemiBold, 600)}${face('Inter', interBold, 700)}
${face('Noto Sans Sinhala', sinhalaRegular, 400)}${face('Noto Sans Sinhala', sinhalaSemiBold, 600)}${face('Noto Sans Sinhala', sinhalaBold, 700)}
@page{size:A4;margin:14mm}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:'Inter','Noto Sans Sinhala',Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:16px}
table{border-collapse:collapse}
@media print{body{padding:0}}
</style></head><body>${bodyHtml}</body></html>`
}

// Print through a hidden iframe so the app page itself never has to enter a
// print mode; resolved once the print dialog closes (or after a safety timeout).
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe')
    frame.setAttribute('aria-hidden', 'true')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;'
    document.body.appendChild(frame)
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.setTimeout(() => frame.remove(), 500)
      resolve()
    }
    frame.onload = () => {
      const win = frame.contentWindow
      if (!win) return finish()
      win.onafterprint = finish
      // Give bundled fonts a moment to load before the dialog snapshots the page
      const ready = (win.document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve()
      void ready.then(() => {
        win.focus()
        win.print()
        window.setTimeout(finish, 60_000)
      })
    }
    frame.srcdoc = html
  })
}
