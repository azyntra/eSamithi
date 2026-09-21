// Typography gate. Sinhala is this app's default language, and on Android a
// `fontWeight` on text carrying a custom family makes the system Sinhala face
// take over at regular weight — so "bold" silently disappears. 66 Text nodes
// had no family at all and rendered in the phone's system font beside
// components that rendered in Inter. This keeps that from coming back.
//
//   node scripts/check-type.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TYPOGRAPHY = 'src/typography.tsx'
const SCALE = new Set([12, 14, 16, 18, 22, 28])
// The ghost "eS" watermark is decorative, not type.
const EXEMPT_SIZES = new Set([100])
const problems = []

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = walk(path.join(root, 'src'))
let textNodes = 0

for (const file of files) {
  const rel = path.relative(root, file)
  const text = readFileSync(file, 'utf8')

  // 1. fontWeight is the bug itself. The family carries the weight instead.
  if (rel !== TYPOGRAPHY) {
    text.split('\n').forEach((line, i) => {
      if (/fontWeight/.test(line.replace(/\/\/.*$/, ''))) {
        problems.push(`${rel}:${i + 1}  fontWeight — on Android this drops Sinhala to the system face at regular weight. Use ty.family.* instead`)
      }
    })
  }

  // 2. Every Text needs a family, and language-aware text needs a line height.
  for (const m of text.matchAll(/<(?:Animated\.)?Text\b[^>]*?>/gs)) {
    const tag = m.group ? m.group(0) : m[0]
    const at = `${rel}:${text.slice(0, m.index).split('\n').length}`
    textNodes++
    if (!/fontFamily/.test(tag)) {
      problems.push(`${at}  <Text> with no fontFamily — renders in the phone's system font`)
    }
    // A Text with no fontSize is nested and inherits both size and leading.
    if (/ty\.family\./.test(tag) && /fontSize/.test(tag) && !/lineHeight/.test(tag)) {
      problems.push(`${at}  language-aware <Text> with no lineHeight — Sinhala stacks marks above and below the baseline and will crowd`)
    }
  }

  // 3. One scale, six steps.
  text.split('\n').forEach((line, i) => {
    const m = /fontSize:\s*([0-9.]+)/.exec(line)
    if (!m) return
    const size = Number(m[1])
    if (!SCALE.has(size) && !EXEMPT_SIZES.has(size)) {
      problems.push(`${rel}:${i + 1}  fontSize ${size} is off the scale (${[...SCALE].join(' · ')})`)
    }
  })
}

if (problems.length) {
  console.error(`check:type failed with ${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`check:type ok — ${textNodes} Text nodes, every one with a family and a leading, every size on the scale`)
