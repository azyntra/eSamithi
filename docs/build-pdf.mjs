// Render a requirements document to PDF, the way the ones in this folder were
// made — but repeatably, because the last one drifted two days behind its
// markdown within a week of being produced by hand.
//
//   node docs/build-pdf.mjs ESAMITHI-WEB-APP-REQUIREMENTS
//   node docs/build-pdf.mjs            # every .md here that already has a .pdf
//
// marked comes from npx rather than a dependency: no app package should carry
// a docs tool in its lockfile. Chromium comes from web/, which already has it
// for the end-to-end lane.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(here, '..', 'web', 'package.json'))
const { chromium } = require('playwright')

const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root { color-scheme: light }
  body {
    font: 10.5pt/1.55 -apple-system, "Segoe UI", system-ui, sans-serif;
    color: #0F172A; margin: 0;
  }
  :lang(si), .si { line-height: 1.65 }
  h1, h2, h3, h4 { color: #143B7C; line-height: 1.25; margin: 1.6em 0 .5em; break-after: avoid }
  h1 { font-size: 22pt; margin-top: 0 }
  h2 { font-size: 15pt; border-bottom: 1.5px solid #D8E6FC; padding-bottom: .25em; break-before: page }
  h2:first-of-type { break-before: auto }
  h3 { font-size: 12pt } h4 { font-size: 10.5pt }
  p, ul, ol { margin: .5em 0 }
  li { margin: .15em 0 }
  a { color: #1854B8; text-decoration: none }
  code { font: 9pt/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
         background: #EEF4FE; padding: .1em .35em; border-radius: 3px }
  pre { background: #F5F7FA; border: 1px solid #D8E6FC; border-radius: 6px;
        padding: .7em .9em; overflow-x: auto; break-inside: avoid }
  pre code { background: none; padding: 0 }
  table { border-collapse: collapse; width: 100%; margin: .8em 0; font-size: 9pt }
  th, td { border: 1px solid #B3CDF8; padding: .35em .5em; text-align: left; vertical-align: top }
  th { background: #EEF4FE; font-weight: 600 }
  tr { break-inside: avoid }
  blockquote { margin: .8em 0; padding: .4em .9em; border-left: 3px solid #85B0F2;
               background: #F8FAFF; color: #334155 }
  hr { border: 0; border-top: 1px solid #D8E6FC; margin: 1.6em 0 }
`

async function build(name, browser) {
  const md = path.join(here, `${name}.md`)
  if (!existsSync(md)) throw new Error(`no such document: ${md}`)
  // -o rather than reading stdout: marked's CLI exits without waiting for a
  // stdout pipe to drain, so anything past the 64 KB pipe buffer is lost —
  // silently, which cost this script its first two-thirds of a document.
  const rendered = path.join(here, `.${name}.body.html`)
  execFileSync('npx', ['-y', 'marked@15', '--gfm', '-i', md, '-o', rendered], { stdio: ['ignore', 'inherit', 'inherit'] })
  const body = readFileSync(rendered, 'utf8')
  unlinkSync(rendered)
  if (body.length < 1000) throw new Error(`${name}: rendered body is suspiciously short (${body.length} bytes)`)

  const html = path.join(here, `.${name}.tmp.html`)
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><title>${name}</title><style>${CSS}</style>${body}`)

  const page = await browser.newPage()
  try {
    await page.goto(`file://${html}`, { waitUntil: 'load' })
    await page.pdf({
      path: path.join(here, `${name}.pdf`),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font:8pt -apple-system,sans-serif;color:#94A3B8;padding:0 16mm;display:flex;justify-content:space-between">' +
        `<span>${name}</span><span class="pageNumber"></span></div>`,
      margin: { top: '18mm', right: '16mm', bottom: '20mm', left: '16mm' }
    })
  } finally {
    await page.close()
    // KEEP_HTML=1 leaves the styled intermediate behind: when a PDF looks
    // wrong it is almost always the CSS, and that is the file to open.
    if (!process.env.KEEP_HTML) unlinkSync(html)
  }
  return path.join(here, `${name}.pdf`)
}

const asked = process.argv.slice(2)
const names = asked.length
  ? asked.map((a) => a.replace(/\.(md|pdf)$/, ''))
  : readdirSync(here)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, ''))
      .filter((n) => existsSync(path.join(here, `${n}.pdf`)))

const browser = await chromium.launch()
try {
  for (const name of names) {
    const out = await build(name, browser)
    const kb = Math.round(statSync(out).size / 1024)
    console.log(`  ${path.basename(out)}  ${kb} KB`)
  }
} finally {
  await browser.close()
}
