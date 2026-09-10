// Dev helper: screenshots the loan portfolio, the issue form and a loan detail page.
//   E2E_SAMITHI_CODE=… node scripts/shoot-loans.mjs <outDir>
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
await page.goto('http://localhost:5173/loans', { waitUntil: 'networkidle' })
await page.getByRole('table').locator('tbody tr:not([data-skeleton])').first().waitFor()
await page.waitForTimeout(500)
await page.screenshot({ path: `${out}/loans-portfolio.png` })
await page.getByRole('button', { name: /issue new loan/i }).first().click()
await page.getByRole('dialog').getByRole('combobox', { name: /applicant member/i }).click()
await page.getByRole('listbox').last().getByRole('option', { name: /Sachira/i }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/loan-issue-form.png` })
await page.keyboard.press('Escape')
const discard = page.getByRole('alertdialog')
if (await discard.isVisible().catch(() => false)) await discard.getByRole('button', { name: /^discard$/i }).click()
await page.getByRole('table').locator('tbody tr:not([data-skeleton])').first().getByRole('link').first().click()
await page.waitForURL(/loans\/\d+/)
await page.getByText(/guarantors \(/i).waitFor()
await page.getByText(/repayment history/i).waitFor()
await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/loan-detail.png` })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
