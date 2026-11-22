// Token gate (docs/MOBILE-APP-REDESIGN-REQUIREMENTS.md §10).
//
//   node scripts/check-tokens.mjs
//
// Screens take every colour from the palette (src/theme.tsx) so light, dark and
// the contrast gate all see the same values. A hex or rgba() literal in a screen
// is a colour the contrast gate never checked and dark mode never adapts.
//
// Deliberately NOT run from package.json: scripts there feed the Expo runtime
// fingerprint, and a changed fingerprint orphans every phone on the current build.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Files allowed to carry literal colours, and why
const ALLOW = new Map([
  // The camera viewfinder sits on live video, not on a themed surface
  ['src/app/attendance/[id].tsx', 'camera overlay']
])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const COLOUR = /(['"`])#[0-9a-fA-F]{3,8}\1|rgba?\(/
const problems = []
let files = 0
for (const file of walk(path.join(root, 'src/app'))) {
  const rel = path.relative(root, file).split(path.sep).join('/')
  files++
  if (ALLOW.has(rel)) continue
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '')
    if (COLOUR.test(code)) problems.push(`${rel}:${i + 1}  literal colour — use a palette token from usePalette()`)
  })
}

if (problems.length) {
  console.error(`check:tokens failed with ${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`check:tokens ok — ${files} screen files, no literal colours outside ${ALLOW.size} allow-listed file(s)`)
