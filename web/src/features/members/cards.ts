import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { esc } from '@/lib/print/receipt'
import { qrMatrix, qrSvg } from '@/lib/qr/qr'

// Printed membership QR cards, for members who do not use the mobile app
// (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §4.7).
//
// ID-card size (85.6 × 54 mm), ten to an A4 sheet, black on white so a
// photocopy still scans. A card carries the society name, the member's name,
// the society ID and the QR — nothing that matters if the card is lost.

export interface CardMember {
  id: number
  society_id: string
  full_name: string | null
}

export const CARDS_PER_SHEET = 10
const CARD_W = 85.6
const CARD_H = 54
const QR_MM = 34 // incl. quiet zone → the code itself is ≈ 27–29 mm

const pt = (k: TranslationKey) => translate(currentLang(), k)

function card(member: CardMember, societyName: string, svg: string): string {
  const name = member.full_name?.trim()
  return `
    <div style="box-sizing:border-box;width:${CARD_W}mm;height:${CARD_H}mm;padding:4mm 4mm 4mm 5mm;border:0.2mm dashed #999;display:flex;align-items:center;gap:3mm;overflow:hidden;break-inside:avoid;">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <div style="font-size:8.5pt;font-weight:700;line-height:1.25;color:#111;max-height:2.6em;overflow:hidden;">${esc(societyName)}</div>
        <div>
          ${name ? `<div style="font-size:11pt;font-weight:700;line-height:1.25;max-height:3.8em;overflow:hidden;word-break:break-word;">${esc(name)}</div>` : ''}
          <div style="font-size:6.5pt;color:#555;margin-top:1.5mm;text-transform:uppercase;letter-spacing:.04em;">${esc(pt('common.societyId'))}</div>
          <div style="font-size:15pt;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;word-break:break-all;">${esc(member.society_id)}</div>
        </div>
        <div style="font-size:6pt;color:#777;">eSamithi</div>
      </div>
      <div style="flex:none;width:${QR_MM}mm;height:${QR_MM}mm;">${svg}</div>
    </div>`
}

// Body HTML for the print preview. Sheets of ten, two across; the @page rule
// narrows the margins so five 54 mm rows fit an A4 page with room to spare.
export async function buildCardsHtml(members: CardMember[], societyName: string): Promise<string> {
  const cards: string[] = []
  for (const m of members) {
    const matrix = await qrMatrix(String(m.society_id))
    cards.push(card(m, societyName, qrSvg(matrix, { sizeMm: QR_MM })))
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
