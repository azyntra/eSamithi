// Contrast gate. Six pairs in this palette used to fail WCAG AA, including the
// primary blue both as a text colour and under a white button label, and the
// three semantic colours on their own soft backgrounds. Members read this app
// outdoors, on cheap screens, often with presbyopia.
//
//   node scripts/check-contrast.mjs
//
// Thresholds: 4.5:1 for text (WCAG 1.4.3 AA), 3:1 for icons, control
// boundaries and state indicators (1.4.11).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(path.join(root, 'src/theme.tsx'), 'utf8')

function palette(name) {
  const block = new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n  \\}`).exec(src)
  if (!block) throw new Error(`palette ${name} not found in src/theme.tsx`)
  const out = {}
  for (const m of block[1].matchAll(/(\w+):\s*'(#[0-9a-fA-F]{6})'/g)) out[m[1]] = m[2]
  return out
}

const lin = (c) => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
const lum = (h) => {
  const n = h.replace('#', '')
  return 0.2126 * lin(parseInt(n.slice(0, 2), 16)) + 0.7152 * lin(parseInt(n.slice(2, 4), 16)) + 0.0722 * lin(parseInt(n.slice(4, 6), 16))
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, minimum, what it is]
const PAIRS = [
  ['text', 'surface', 4.5, 'body text on a card'],
  ['text', 'bg', 4.5, 'body text on the page'],
  ['textMuted', 'bg', 4.5, 'secondary text on the page'],
  ['textMuted', 'surface', 4.5, 'secondary text on a card'],
  ['textMuted', 'surfaceAlt', 4.5, 'secondary text on an inset'],
  ['primary', 'surface', 4.5, 'links and icons on a card'],
  ['primary', 'bg', 4.5, 'links and icons on the page'],
  ['onPrimary', 'primary', 4.5, 'label on a filled brand control'],
  ['onPrimary', 'gradStart', 4.5, 'button label on the light end of the gradient'],
  ['onPrimary', 'gradEnd', 4.5, 'button label on the dark end of the gradient'],
  ['primaryOnSoft', 'primarySoft', 4.5, 'label on a tinted chip or secondary button'],
  ['success', 'successBg', 4.5, 'success text on its tint'],
  ['warning', 'warningBg', 4.5, 'warning text on its tint'],
  ['danger', 'dangerBg', 4.5, 'danger text on its tint'],
  ['success', 'surface', 4.5, 'money in credit on a card'],
  ['danger', 'surface', 4.5, 'money owed on a card'],
  ['warning', 'surface', 4.5, 'attention text on a card'],
]

const problems = []
let checked = 0
for (const scheme of ['light', 'dark']) {
  const pal = palette(scheme)
  for (const [fg, bg, min, what] of PAIRS) {
    if (!pal[fg] || !pal[bg]) { problems.push(`${scheme}: missing token ${!pal[fg] ? fg : bg}`); continue }
    const r = ratio(pal[fg], pal[bg])
    checked++
    if (r < min) problems.push(`${scheme}  ${what}: ${fg} ${pal[fg]} on ${bg} ${pal[bg]} = ${r.toFixed(2)}:1, needs ${min}:1`)
  }
}

if (problems.length) {
  console.error(`check:contrast failed with ${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`check:contrast ok — ${checked} pairs across both themes, all at or above WCAG AA`)
