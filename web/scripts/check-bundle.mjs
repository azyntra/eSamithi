#!/usr/bin/env node
// Performance budget (requirements NFR-1): the first load must stay small on
// a counter PC over a Sri Lankan office connection. Everything the browser
// needs before the dashboard can paint counts — the entry chunk, every
// module it preloads, and the stylesheet — measured gzipped, the way nginx
// serves them.
import { gzipSync } from 'node:zlib'
import { readFileSync, statSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const DIST = process.argv[2] ?? 'dist'
const BUDGETS = { initialJs: 250 * 1024, css: 60 * 1024, fonts: 350 * 1024 }

const html = readFileSync(join(DIST, 'index.html'), 'utf8')
const refs = [...html.matchAll(/(?:src|href)="\/?([^"]*assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
if (refs.length === 0) {
  console.error('check:bundle — no assets referenced from index.html; did the build run?')
  process.exit(1)
}

const gz = (p) => gzipSync(readFileSync(join(DIST, p.replace(/^\//, '')))).length
const js = refs.filter((r) => r.endsWith('.js'))
const css = refs.filter((r) => r.endsWith('.css'))
const initialJs = js.reduce((n, f) => n + gz(f), 0)
const cssBytes = css.reduce((n, f) => n + gz(f), 0)

let fonts = 0
try {
  const dir = join(DIST, 'assets')
  for (const f of await readdir(dir)) if (/\.(woff2?|ttf)$/.test(f)) fonts += statSync(join(dir, f)).size
} catch {
  /* no font directory */
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`
const rows = [
  ['initial JS (gzip)', initialJs, BUDGETS.initialJs, `${js.length} files`],
  ['CSS (gzip)', cssBytes, BUDGETS.css, `${css.length} files`],
  ['fonts (raw)', fonts, BUDGETS.fonts, 'self-hosted woff2']
]
let failed = false
for (const [name, actual, budget, note] of rows) {
  const over = actual > budget
  failed ||= over
  console.log(`${over ? 'FAIL' : 'ok  '}  ${name.padEnd(20)} ${kb(actual).padStart(10)} / ${kb(budget).padStart(9)}  (${note})`)
}
if (failed) {
  console.error('\ncheck:bundle — over budget. Split a route, drop a dependency, or agree a new budget in the requirements.')
  process.exit(1)
}
console.log('check:bundle ok')
