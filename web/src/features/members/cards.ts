import { currentLang, translate, type TranslationKey } from '@/lib/i18n'
import { esc } from '@/lib/print/receipt'
import { qrMatrix, qrSvg } from '@/lib/qr/qr'

// Printed membership cards (docs/MOBILE-STAFF-ATTENDANCE-REQUIREMENTS.md §4.7).
//
// ID-card size (85.6 × 54 mm), ten to an A4 sheet with a gutter between cards
// so each one can be cut out around its rounded outline.
//
//   ┌ brand-gradient header: eS logo tile · "Membership card" · society name ┐
//   │ full name (wraps, never cut off)                      ┌──────────┐     │
//   │ ┃ MEMBERSHIP NO.  217        (tinted panel)           │    QR    │     │
//   │ [id] NIC 806593052V                                    │  tile    │     │
//   │ [☎] Phone 070 136 6809                                 └──────────┘     │
//   └ gradient footer: "If found, please return…"                 eSamithi ┘
//
// The QR holds only the society ID, so the office USB scanner, the mobile
// scanner and a photocopy all read it. NIC and phone are on the card at the
// societies' request, so it doubles as a member ID.

export interface CardMember {
  id: number
  society_id: string
  full_name: string | null
  nic?: string | null
  phone?: string | null
}

/** False for a member with no name (null, empty or only spaces): bulk card printing skips them. */
export const hasCardName = (m: Pick<CardMember, 'full_name'>): boolean => (m.full_name ?? '').trim() !== ''

export const CARDS_PER_SHEET = 10
const CARD_W = 85.6
const CARD_H = 54
const HEADER_H = 12.5 // includes the curved edge
const FOOTER_H = 3.5
const QR_TILE = 33.5
const QR_SVG = 31.3 // inside the tile's border and padding; one-module quiet zone → code ≈ 28.6 mm
const GUTTER = 3

const BLUE = '#1E64D4'
const DEEP = '#0D3B8C'
const INK = '#0F2547'
const MUTED = '#5B6B82'
const TINT = '#EAF1FD'
const GRADIENT = `linear-gradient(120deg, ${BLUE} 0%, #1752B4 55%, ${DEEP} 100%)`

const pt = (k: TranslationKey) => translate(currentLang(), k)

// Long names step down so the whole name fits in the text column.
export function nameSize(name: string): number {
  const n = [...name].length
  if (n <= 20) return 11.5
  if (n <= 34) return 10.5
  if (n <= 52) return 9.5
  return 8
}

// The membership number is the most important thing on the card; long formats
// (e.g. MKG/2024/0123) step down so they stay on one line.
export function numberSize(id: string): number {
  const n = id.length
  if (n <= 8) return 16
  if (n <= 12) return 12.5
  return 10
}

// 0701366809 → 070 136 6809; anything else prints as entered.
export function formatPhone(phone: string): string {
  const d = phone.replace(/[\s-]/g, '')
  return /^0\d{9}$/.test(d) ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : phone.trim()
}

// ---- pieces -----------------------------------------------------------------

// The eS app-icon tile, inverted (white tile, blue letters) to sit on the gradient.
const logo = `
  <div style="flex:none;width:8mm;height:8mm;border-radius:2mm;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0.3mm 0.8mm rgba(8,30,70,.35);">
    <span style="font-size:11pt;font-weight:700;letter-spacing:-.03em;line-height:1;color:${BLUE};margin-top:-.2mm;">eS</span>
  </div>`

// Lucide "id-card" and "phone", stroked in brand blue.
const ICONS = {
  nic: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10.5" r="2"/><path d="M6.2 15.5a3 3 0 0 1 5.6 0M15 10h3M15 14h3"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>'
}

function detail(icon: keyof typeof ICONS, key: TranslationKey, value: string | null | undefined): string {
  const v = value?.trim()
  if (!v) return ''
  return `
    <div style="display:flex;align-items:center;gap:1.5mm;margin-top:1.1mm;">
      <div style="flex:none;width:4.2mm;height:4.2mm;border-radius:50%;background:${TINT};display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="2.5mm" height="2.5mm" fill="none" stroke="${BLUE}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>
      </div>
      <div style="min-width:0;display:flex;align-items:baseline;gap:1.4mm;line-height:1.1;white-space:nowrap;">
        <span style="flex:none;font-size:5.3pt;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.06em;">${esc(pt(key))}</span>
        <span style="min-width:0;font-size:8.8pt;font-weight:700;color:${INK};letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;">${esc(v)}</span>
      </div>
    </div>`
}

function header(societyName: string): string {
  return `
    <div style="position:relative;flex:none;height:${HEADER_H}mm;background:${GRADIENT};color:#fff;overflow:hidden;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;" aria-hidden="true">
        <circle cx="92" cy="2" r="22" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="0.8"/>
        <circle cx="92" cy="2" r="31" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="0.8"/>
        <circle cx="92" cy="2" r="40" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="0.8"/>
      </svg>
      <div style="position:absolute;right:3mm;top:-3.2mm;font-size:30pt;font-weight:700;letter-spacing:-.04em;color:rgba(255,255,255,.08);line-height:1;">eS</div>
      <div style="position:relative;display:flex;align-items:center;gap:2.4mm;height:${HEADER_H - 2.4}mm;padding:0 4mm;">
        ${logo}
        <div style="min-width:0;flex:1;">
          <div style="font-size:5.3pt;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.78);line-height:1.2;">${esc(pt('members.cardTitle'))}</div>
          <div style="font-size:8.3pt;font-weight:700;line-height:1.18;max-height:2.36em;overflow:hidden;margin-top:.3mm;">${esc(societyName)}</div>
        </div>
      </div>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" preserveAspectRatio="none" style="position:absolute;left:0;right:0;bottom:-0.1mm;width:100%;height:3mm;" aria-hidden="true">
        <path d="M0 10V7.5C18 1.5 38 1 58 4.5S88 8.5 100 3V10Z" fill="#fff"/>
      </svg>
    </div>`
}

const footer = () => `
  <div style="flex:none;height:${FOOTER_H}mm;background:${GRADIENT};color:rgba(255,255,255,.92);display:flex;align-items:center;justify-content:space-between;gap:2mm;padding:0 4mm;font-size:5.2pt;line-height:1;">
    <span style="min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(pt('members.cardFound'))}</span>
    <span style="flex:none;font-weight:700;letter-spacing:.04em;color:#fff;">eSamithi</span>
  </div>`

function card(member: CardMember, societyName: string, svg: string): string {
  const name = member.full_name?.trim()
  const fs = name ? nameSize(name) : 11
  return `
    <div style="box-sizing:border-box;width:${CARD_W}mm;height:${CARD_H}mm;border-radius:3.2mm;border:0.25mm solid #C9D6EA;overflow:hidden;break-inside:avoid;background:#fff;display:flex;flex-direction:column;">
      ${header(societyName)}
      <div style="flex:1;min-height:0;display:flex;gap:3mm;padding:1.2mm 3.3mm 1.6mm 4mm;">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <div style="flex:1;min-height:0;overflow:hidden;">
            ${name ? `<div style="font-size:${fs}pt;font-weight:700;line-height:1.18;color:${INK};max-height:${(1.18 * 4).toFixed(2)}em;overflow:hidden;overflow-wrap:anywhere;">${esc(name)}</div>` : ''}
          </div>
          <div style="flex:none;margin-top:1mm;">
            <div style="position:relative;background:${TINT};border-radius:1.6mm;padding:.8mm 2mm .8mm 2.6mm;overflow:hidden;">
              <div style="position:absolute;left:0;top:0;bottom:0;width:0.9mm;background:${GRADIENT};"></div>
              <div style="font-size:5.3pt;font-weight:600;color:${MUTED};text-transform:uppercase;letter-spacing:.08em;line-height:1.2;">${esc(pt('members.cardMemberNo'))}</div>
              <div style="font-size:${numberSize(member.society_id)}pt;font-weight:700;line-height:1.05;color:${BLUE};letter-spacing:.01em;overflow-wrap:anywhere;">${esc(member.society_id)}</div>
            </div>
            ${detail('nic', 'members.nic', member.nic)}
            ${detail('phone', 'common.phone', member.phone ? formatPhone(member.phone) : null)}
          </div>
        </div>
        <div style="flex:none;align-self:center;box-sizing:border-box;width:${QR_TILE}mm;height:${QR_TILE}mm;border-radius:2.4mm;border:0.3mm solid #D3DFF3;background:#fff;display:flex;align-items:center;justify-content:center;">
          <div style="width:${QR_SVG}mm;height:${QR_SVG}mm;">${svg}</div>
        </div>
      </div>
      ${footer()}
    </div>`
}

// Body HTML for the print preview. Sheets of ten, two across, with a gutter so
// every card can be cut out on its own; the @page margins leave room for five rows.
export async function buildCardsHtml(members: CardMember[], societyName: string): Promise<string> {
  const cards: string[] = []
  for (const m of members) {
    const matrix = await qrMatrix(String(m.society_id))
    cards.push(card(m, societyName, qrSvg(matrix, { sizeMm: QR_SVG, quiet: 1 })))
  }
  const sheets: string[] = []
  for (let i = 0; i < cards.length; i += CARDS_PER_SHEET) {
    const last = i + CARDS_PER_SHEET >= cards.length
    sheets.push(
      `<div style="display:grid;grid-template-columns:${CARD_W}mm ${CARD_W}mm;gap:${GUTTER}mm ${GUTTER + 1}mm;justify-content:center;${last ? '' : 'break-after:page;'}">${cards.slice(i, i + CARDS_PER_SHEET).join('')}</div>`
    )
  }
  // On screen the preview pane can be narrower than a two-card sheet (≈ 700 px):
  // shrink it to fit there. Print is untouched.
  const screen = '@media screen and (max-width:740px){body{zoom:.78}}@media screen and (max-width:580px){body{zoom:.6}}@media screen and (max-width:440px){body{zoom:.45}}'
  return `<style>@page{size:A4;margin:6mm 10mm}body{padding:0 !important}${screen}</style>${sheets.join('')}`
}

export const sheetCount = (members: number): number => Math.ceil(members / CARDS_PER_SHEET)
