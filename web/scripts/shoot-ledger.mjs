// Dev helper: screenshots the income ledger, the record-income sheet and the print preview.
//   E2E_SAMITHI_CODE=… node scripts/shoot-ledger.mjs <outDir>
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
await page.goto('http://localhost:5173/incomes', { waitUntil: 'networkidle' })
await page.getByRole('table').locator('tbody tr:not([data-skeleton])').first().waitFor()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/incomes-list.png` })
await page.getByRole('button', { name: /record income/i }).click()
const sheet = page.getByRole('dialog')
const select = sheet.getByLabel(/income type/i)
const options = await select.locator('option').allTextContents()
await select.selectOption({ label: options.find((o) => /membership/i.test(o)) ?? options[1] })
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/income-form.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
const discard = page.getByRole('alertdialog')
if (await discard.isVisible().catch(() => false)) await discard.getByRole('button', { name: /^discard$/i }).click()
await page.getByRole('table').locator('tbody tr:not([data-skeleton])').first().getByRole('button', { name: /print receipt/i }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/income-print-preview.png` })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
