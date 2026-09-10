// Dev helper: screenshots the Financial Hub tabs and the FD form.
//   E2E_SAMITHI_CODE=… node scripts/shoot-wallet.mjs <outDir>
import { chromium } from '@playwright/test'
const out = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
const code = page.getByLabel(/samithi code/i)
if (await code.isVisible().catch(() => false)) { await code.fill(process.env.E2E_SAMITHI_CODE); await page.getByRole('button', { name: /find samithi/i }).click() }
await page.getByLabel(/username/i).fill('admin'); await page.getByLabel(/^password/i).fill('admin123'); await page.getByRole('button', { name: /^sign in$/i }).click()
await page.waitForURL(/dashboard/)
await page.goto('http://localhost:5173/wallet', { waitUntil: 'networkidle' })
await page.getByRole('table').locator('tbody tr:not([data-skeleton])').first().waitFor()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/wallet-liquid.png` })
await page.getByRole('tab', { name: /fixed deposits/i }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/wallet-fds.png` })
await page.getByRole('button', { name: /new investment/i }).first().click()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/wallet-fd-form.png` })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
