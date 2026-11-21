import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { esc } from '@/lib/print/receipt'
import { qrMatrix, qrSvg } from '@/lib/qr/qr'

// Printed membership cards (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §4.7).
//
// ID-card size (85.6 × 54 mm), ten to an A4 sheet. A navy header band carries
// the society name; the body has the member's full name (never cut off — it
// wraps and steps down a size when long), the membership number set large,
// NIC and phone, and a large QR on white. The QR holds only the society ID,
// so the office USB scanner, the mobile scanner and a photocopy all read it.
// Societies asked for NIC and phone on the card so it doubles as a member ID.

export interface CardMember {
  id: number
  society_id: string
  full_name: string | null
  nic?: string | null
  phone?: string | null
}

export const CARDS_PER_SHEET = 10
const CARD_W = 85.6
const CARD_H = 54
const HEADER_H = 11
const QR_MM = 34 // two-module quiet zone → the code itself is ≈ 28.5 mm
const QR_QUIET = 2 // the white card around it completes the quiet zone
const NAVY = '#0F2E5C'

const pt = (k: TranslationKey) => translate(currentLang(), k)

// Long names step down so the whole name fits in the text column.
export function nameSize(name: string): number {
  const n = [...name].length
  if (n <= 20) return 11.5
  if (n <= 34) return 10.5
  if (n <= 52) return 9.5
  return 8
}

// The membership number is the biggest thing on the card; long formats
// (e.g. MKG/2024/0123) step down so they stay on one line.
export function numberSize(id: string): number {
  const n = id.length
  if (n <= 8) return 17
  if (n <= 12) return 13
  return 10.5
}

// 0701366809 → 070 136 6809; anything else prints as entered.
export function formatPhone(phone: string): string {
  const d = phone.replace(/[\s-]/g, '')
  return /^0\d{9}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : phone.trim()
}

const label = (text: string) =>
  `<div style="font-size:6pt;font-weight:600;color:#5B6472;text-transform:uppercase;letter-spacing:.06em;line-height:1.2;">${esc(text)}</div>`

function detail(key: TranslationKey, value: string | null | undefined): string {
  const v = value?.trim()
  if (!v) return ''
  return `<div style="display:flex;align-items:baseline;gap:1.5mm;margin-top:1.2mm;">
      <div style="flex:none;width:11mm;font-size:6pt;font-weight:600;color:#5B6472;text-transform:uppercase;letter-spacing:.04em;">${esc(pt(key))}</div>
      <div style="min-width:0;font-size:9pt;font-weight:700;color:#111;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(v)}</div>
    </div>`
}

function card(member: CardMember, societyName: string, svg: string): string {
  const name = member.full_name?.trim()
  const fs = name ? nameSize(name) : 11
  return `
    <div style="box-sizing:border-box;width:${CARD_W}mm;height:${CARD_H}mm;border:0.2mm dashed #9CA3AF;overflow:hidden;break-inside:avoid;background:#fff;display:flex;flex-direction:column;">
      <div style="flex:none;height:${HEADER_H}mm;box-sizing:border-box;background:${NAVY};color:#fff;padding:0 4mm;display:flex;align-items:center;gap:3mm;border-bottom:0.8mm solid #3B82F6;">
        <div style="flex:1;min-width:0;font-size:8.5pt;font-weight:700;line-height:1.2;max-height:2.4em;overflow:hidden;">${esc(societyName)}</div>
        <div style="flex:none;font-size:5.8pt;font-weight:600;letter-spacing:.1em;text-transform:uppercase;opacity:.85;text-align:right;line-height:1.2;">${esc(pt('members.cardTitle'))}</div>
      </div>
      <div style="flex:1;min-height:0;display:flex;gap:2.5mm;padding:2.5mm 3mm 2mm 4mm;">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          ${name ? `<div style="font-size:${fs}pt;font-weight:700;line-height:1.22;color:#111;max-height:${(1.22 * 4).toFixed(2)}em;overflow:hidden;overflow-wrap:anywhere;">${esc(name)}</div>` : ''}
          <div style="margin-top:auto;">
            ${label(pt('members.cardMemberNo'))}
            <div style="font-size:${numberSize(member.society_id)}pt;font-weight:800;line-height:1.1;color:${NAVY};letter-spacing:.01em;overflow-wrap:anywhere;">${esc(member.society_id)}</div>
            ${detail('members.nic', member.nic)}
            ${detail('common.phone', member.phone ? formatPhone(member.phone) : null)}
          </div>
        </div>
        <div style="flex:none;width:${QR_MM}mm;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="width:${QR_MM}mm;height:${QR_MM}mm;">${svg}</div>
          <div style="margin-top:.6mm;font-size:5.5pt;color:#5B6472;text-align:center;line-height:1.15;">${esc(pt('members.cardScanHint'))}</div>
        </div>
      </div>
    </div>`
}

// Body HTML for the print preview. Sheets of ten, two across; the @page rule
// narrows the margins so five 54 mm rows fit an A4 page with room to spare.
export async function buildCardsHtml(members: CardMember[], societyName: string): Promise<string> {
  const cards: string[] = []
  for (const m of members) {
    const matrix = await qrMatrix(String(m.society_id))
    cards.push(card(m, societyName, qrSvg(matrix, { sizeMm: QR_MM, quiet: QR_QUIET })))
  }
  const sheets: string[] = []
  for (let i = 0; i < cards.length; i += CARDS_PER_SHEET) {
    const last = i + CARDS_PER_SHEET >= cards.length
    sheets.push(
      `<div style="display:grid;grid-template-columns:${CARD_W}mm ${CARD_W}mm;justify-content:center;${last ? '' : 'break-after:page;'}">${cards.slice(i, i + CARDS_PER_SHEET).join('')}</div>`
    )
  }
  return `<style>@page{size:A4;margin:10mm}body{padding:0 !important}</style>${sheets.join('')}`
}

export const sheetCount = (members: number): number => Math.ceil(members / CARDS_PER_SHEET)
