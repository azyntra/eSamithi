import { formatCurrency, formatNumber } from '@/lib/format/currency'
import { formatDate, todayIso } from '@/lib/format/dates'
import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { esc } from '@/lib/print/receipt'

const pt = (k: TranslationKey, vars?: Record<string, string | number>) => translate(currentLang(), k, vars)

export interface ReportSection {
  title: string
  headers: string[]
  align?: Array<'left' | 'right'>
  rows: Array<Array<string | number>>
  footer?: Array<string | number>
  note?: string
}

// A4 report: society letterhead, the period, ruled tables that repeat their
// header across pages, and no application chrome (requirements FR-8.4).
export function buildReportHtml(opts: { societyName: string; address?: string | null; phone?: string | null; title: string; period?: string; sections: ReportSection[] }): string {
  const head = `
    <header style="text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px;">
      <div style="font-size:19px;font-weight:800;">${esc(opts.societyName)}</div>
      ${opts.address || opts.phone ? `<div style="font-size:11px;color:#555;margin-top:2px;">${esc([opts.address, opts.phone].filter(Boolean).join(' · '))}</div>` : ''}
      <div style="font-size:14px;font-weight:600;margin-top:6px;">${esc(opts.title)}</div>
      ${opts.period ? `<div style="font-size:12px;color:#333;margin-top:2px;">${esc(opts.period)}</div>` : ''}
      <div style="font-size:10.5px;color:#666;margin-top:4px;">${esc(pt('reports.generatedOn', { date: formatDate(todayIso(), currentLang()) }))}</div>
    </header>`

  const section = (s: ReportSection): string => {
    const align = (i: number) => (s.align?.[i] === 'right' ? 'text-align:right;' : '')
    const th = s.headers.map((h, i) => `<th style="border:1px solid #999;padding:5px 7px;background:#f1f5f9;font-size:11px;${align(i)}">${esc(h)}</th>`).join('')
    const body = s.rows.length
      ? s.rows.map((r) => `<tr>${r.map((c, i) => `<td style="border:1px solid #ccc;padding:5px 7px;font-size:11.5px;${align(i)}">${esc(c)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${s.headers.length}" style="border:1px solid #ccc;padding:14px;text-align:center;color:#666;font-size:11.5px;">${esc(pt('reports.noEntries'))}</td></tr>`
    const foot = s.footer ? `<tr>${s.footer.map((c, i) => `<td style="border:1px solid #999;padding:6px 7px;font-size:12px;font-weight:700;background:#f8fafc;${align(i)}">${esc(c)}</td>`).join('')}</tr>` : ''
    return `
      <section style="margin-bottom:18px;break-inside:avoid;">
        <h2 style="font-size:13px;font-weight:700;margin:0 0 6px;">${esc(s.title)}</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead style="display:table-header-group;">${th ? `<tr>${th}</tr>` : ''}</thead>
          <tbody>${body}${foot}</tbody>
        </table>
        ${s.note ? `<p style="font-size:10.5px;color:#555;margin:6px 0 0;">${esc(s.note)}</p>` : ''}
      </section>`
  }

  return `<div style="max-width:180mm;margin:0 auto;">${head}${opts.sections.map(section).join('')}
    <footer style="margin-top:26px;display:flex;justify-content:space-between;font-size:10.5px;color:#555;">
      <span>____________________<br/>${esc(pt('rcpt.treasurer'))}</span>
      <span>____________________<br/>${esc(pt('reports.member'))}</span>
    </footer>
  </div>`
}

export const money = formatCurrency
export const count = formatNumber
