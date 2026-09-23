// Motion gate. The app once shipped ten `.damping(n)` calls that each broke a
// Reanimated default that was already critically damped, and the result was
// 44-69% overshoot on every tap, tab switch and toast. This keeps that from
// coming back, and keeps motion values in one file.
//
//   node scripts/check-motion.mjs
//
// Reanimated 4 merges a partial spring config over GentleSpringConfig
// {damping:120, mass:4, stiffness:900}, so an omitted `mass` silently stays 4.
// That is why a partial config is an error here and not a style preference.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MOTION = 'src/motion.ts'
const problems = []

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const DEFAULT_MASS = 4
const DEFAULT_STIFFNESS = 900

const files = walk(path.join(root, 'src'))
for (const file of files) {
  const rel = path.relative(root, file)
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')

  lines.forEach((line, i) => {
    const at = `${rel}:${i + 1}`
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
    if (!code.trim()) return

    // 1. springify() with no argument silently discards any .duration() set
    //    before it — ComplexAnimationBuilder assigns durationV = undefined.
    if (/\.springify\(\s*\)/.test(code)) {
      problems.push(`${at}  .springify() with no argument discards the duration set before it — pass springify(ms)`)
    }

    // 2. A spring config must state damping, stiffness AND mass.
    const spring = /withSpring\([^,]*,\s*\{([^}]*)\}/.exec(code)
    if (spring) {
      const body = spring[1]
      const num = (k) => {
        const m = new RegExp(`${k}\\s*:\\s*([0-9.]+)`).exec(body)
        return m ? Number(m[1]) : null
      }
      const damping = num('damping')
      const stiffness = num('stiffness')
      const mass = num('mass')
      if (damping !== null && (mass === null || stiffness === null)) {
        problems.push(`${at}  partial spring config — mass and stiffness must be stated, or Reanimated supplies mass:${DEFAULT_MASS}/stiffness:${DEFAULT_STIFFNESS} and the ratio collapses`)
      } else if (damping !== null && mass !== null && stiffness !== null) {
        const zeta = damping / (2 * Math.sqrt(stiffness * mass))
        if (zeta < 0.9) {
          problems.push(`${at}  spring damping ratio ${zeta.toFixed(2)} — overshoots. Needs >= 0.9 (damping ${Math.ceil(2 * Math.sqrt(stiffness * mass))} would be critical)`)
        }
      }
    }

    // 3. Layout-builder .damping(n) is the exact shape of the original bug.
    if (/\.damping\(\s*\d/.test(code)) {
      problems.push(`${at}  .damping(n) on a layout builder overrides a critically damped default — remove it`)
    }

    // 4. Motion values live in src/motion.ts and nowhere else.
    if (rel !== MOTION) {
      if (/duration:\s*\d/.test(code) || /\.duration\(\s*\d/.test(code)) {
        problems.push(`${at}  hardcoded duration — use a token from ${MOTION}`)
      }
      if (/\bEasing\./.test(code)) {
        problems.push(`${at}  easing defined at a call site — use ease.* from ${MOTION}`)
      }
    }

    // 5. Builders this app has decided against.
    for (const banned of ['ZoomIn', 'ZoomOut', 'LinearTransition']) {
      if (new RegExp(`\\b${banned}\\b`).test(code)) {
        problems.push(`${at}  ${banned} is not used in this app — it animates scale or layout origin and overshoots visibly`)
      }
    }

    // 6. Exactly one loop is allowed: the skeleton breath.
    if (/withRepeat\(/.test(code) && !/skeletonPhase/.test(text)) {
      problems.push(`${at}  withRepeat outside the skeleton shimmer`)
    }
  })
}

// 7. Thread safety. UI-thread code — a useDerivedValue/useAnimatedStyle body, a
//    gesture handler, a 'worklet' function — may only call other worklets.
//    Calling one of our own plain JS helpers from there makes
//    react-native-worklets throw "Tried to synchronously call a Remote
//    Function"; React blanks the screen and the process carries on, so no
//    crash report is ever filed. This shipped once: every Puruka listing with
//    two or more photos opened blank. The web export cannot show it, because
//    on web worklets run on the JS thread.
{
  const motionSrc = readFileSync(path.join(root, MOTION), 'utf8')
  const fn = /export function timing\([\s\S]*?\{([\s\S]*?)\n\}/.exec(motionSrc)
  if (!fn || !/'worklet'/.test(fn[1])) {
    problems.push(`${MOTION}  timing() must carry the 'worklet' directive — it is called from UI-thread code`)
  }
}
const KNOWN_WORKLETS = new Set(['timing'])
const OPENERS = /(useDerivedValue|useAnimatedStyle|useAnimatedReaction|useAnimatedProps|\.on(?:Start|Update|End|Change|Begin|Finalize|TouchesDown|TouchesMove|TouchesUp))\s*\(/g
function balanced(text, openIdx) {
  // openIdx points at '(' or '{'; return the index just past its match
  const open = text[openIdx], close = open === '(' ? ')' : '}'
  let depth = 0
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth++
    else if (text[i] === close && --depth === 0) return i + 1
  }
  return text.length
}
for (const file of files) {
  const rel = path.relative(root, file)
  const text = readFileSync(file, 'utf8')
  // names this file imports from our own modules — the "remote functions"
  const local = new Set()
  for (const m of text.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*'(\.[^']*)'/g)) {
    if (m[1]) local.add(m[1])
    for (const n of (m[2] || '').split(',')) {
      const name = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()
      if (name && !/^type\b/.test(n.trim())) local.add(name)
    }
  }
  // plus functions this file defines with a 'worklet' directive are fine
  const ownWorklets = new Set([...text.matchAll(/(?:const|function)\s+(\w+)[^{]*\{\s*'worklet'/g)].map((m) => m[1]))
  const regions = []
  for (const m of text.matchAll(OPENERS)) {
    const paren = m.index + m[0].length - 1
    regions.push([paren, balanced(text, paren), m[1]])
  }
  for (const m of text.matchAll(/'worklet'/g)) {
    const brace = text.lastIndexOf('{', m.index)
    if (brace >= 0) regions.push([brace, balanced(text, brace), "'worklet' function"])
  }
  for (const [a, b, kind] of regions) {
    const body = text.slice(a, b)
    for (const c of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) {
      const name = c[1]
      if (!local.has(name) || KNOWN_WORKLETS.has(name) || ownWorklets.has(name)) continue
      const line = text.slice(0, a + c.index).split('\n').length
      problems.push(`${rel}:${line}  ${name}() is a plain JS function called from UI-thread code (${kind}) — this blanks the screen at runtime. Call it from JS (an effect) or make it a worklet`)
    }
  }
}

if (problems.length) {
  console.error(`check:motion failed with ${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log(`check:motion ok — ${files.length} files, every spring critically damped, every value from ${MOTION}`)
