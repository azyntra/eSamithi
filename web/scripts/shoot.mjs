// Dev helper: screenshots the login page in every theme/language/viewport.
//   node scripts/shoot.mjs <outDir>   (needs the dev server on :5173 and Google Chrome)
import { chromium } from '@playwright/test'
const out = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1366, height: 800 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
await page.getByRole('heading').first().waitFor()
await page.screenshot({ path: `${out}/login-en-light.png` })
await page.getByRole('button', { name: 'සිං' }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/login-si-light.png` })
await page.getByRole('button', { name: /dark mode/i }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${out}/login-si-dark.png` })
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(300)
await page.screenshot({ path: `${out}/login-mobile-dark.png` })
console.log('lang=', await page.evaluate(() => document.documentElement.lang), 'theme=', await page.evaluate(() => document.documentElement.dataset.theme))
console.log('errors:', errors.length ? errors : 'none')
await browser.close()
