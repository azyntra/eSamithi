// Dev helper: screenshots the Members list, the add-member sheet and a Member 360 page.
//   E2E_SAMITHI_CODE=… node scripts/shoot-members.mjs <outDir>
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
await page.goto('http://localhost:5173/members', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/members-list.png` })
await page.getByRole('button', { name: /add new member/i }).click()
await page.waitForTimeout(600)
await page.screenshot({ path: `${out}/members-add-sheet.png` })
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.getByRole('table').locator('tbody tr').first().getByRole('link').first().click()
await page.waitForURL(/members\/\d+/)
await page.waitForTimeout(700)
await page.screenshot({ path: `${out}/member-360.png` })
await page.getByRole('tab', { name: /statement/i }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: `${out}/member-360-statement.png` })
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
