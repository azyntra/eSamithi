// Renders a candidate dark palette against the live QA app without deploying:
// the block is injected after the stylesheet, so it wins on equal specificity.
import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync } from 'node:fs'
const [cssPath, outDir] = process.argv.slice(2)
const css = cssPath === 'none' ? '' : readFileSync(cssPath, 'utf8')
mkdirSync(outDir, { recursive: true })
const pass = readFileSync('/private/tmp/claude-501/-Volumes-Data-eSamithi/5e21abd3-ba77-42bb-920e-2580d30509a3/scratchpad/qa-gate-pass.txt', 'utf8').trim()
const base = 'https://console.esamithi.com/app/'

const b = await chromium.launch({ channel: 'chrome' })
const ctx = await b.newContext({ httpCredentials: { username: 'esamithi', password: pass }, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' })
const p = await ctx.newPage()
await p.addInitScript(() => { try { localStorage.setItem('esamithi-theme', 'dark') } catch {} })
const paint = async () => { if (css) await p.addStyleTag({ content: css }) }

await p.goto(base + 'login'); await paint()
await p.getByLabel(/samithi code/i).fill('TES-5155')
await p.getByRole('button', { name: /find samithi/i }).click()
await p.getByLabel(/username/i).fill('admin')
await p.getByLabel(/^password/i).fill('admin123')
await p.getByRole('button', { name: /^sign in$/i }).click()
await p.waitForURL(/dashboard/, { timeout: 25000 })
await p.waitForTimeout(2000); await paint(); await p.waitForTimeout(300)
await p.screenshot({ path: `${outDir}/dashboard.png` })

await p.goto(base + 'loans'); await p.waitForTimeout(2200); await paint(); await p.waitForTimeout(300)
await p.screenshot({ path: `${outDir}/loans.png` })

await p.goto(base + 'incomes?create=1'); await p.waitForTimeout(2200); await paint(); await p.waitForTimeout(400)
await p.screenshot({ path: `${outDir}/form.png` })
console.log('rendered ->', outDir)
await b.close()
