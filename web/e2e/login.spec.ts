import { expect, test } from '@playwright/test'

const CODE = process.env.E2E_SAMITHI_CODE || ''
const USER = process.env.E2E_USER || 'admin'
const PASS = process.env.E2E_PASS || 'admin123'

test.describe('sign-in with a samithi code', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('code → credentials → dashboard, survives reload, signs out', async ({ page }) => {
    await page.goto('login')
    await expect(page.getByRole('heading', { name: /connect your samithi|ඔබේ සමිතිය/i })).toBeVisible()
    await page.getByLabel(/samithi code/i).fill(CODE)
    await page.getByRole('button', { name: /find samithi/i }).click()

    await expect(page.getByRole('heading', { name: /sign in to your samithi/i })).toBeVisible()
    await page.getByLabel(/username/i).fill(USER)
    await page.getByLabel(/^password/i).fill(PASS)
    await page.getByRole('button', { name: /^sign in$/i }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible()
    await expect(page.getByText(/active members/i)).toBeVisible()

    // No token in web storage, samithi context remembered
    const storage = await page.evaluate(() => ({ keys: Object.keys(localStorage), session: Object.keys(sessionStorage) }))
    expect(storage.keys.join(' ')).not.toMatch(/token/i)
    expect(storage.keys).toContain('esamithi.web.samithi')

    // Reload: the refresh cookie restores the session silently
    await page.reload()
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible()

    // Dark mode first, in English: the toggle's label is translated, so after
    // the language switch it no longer reads "dark mode"
    await page.getByRole('button', { name: /dark mode/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: /light mode/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Sinhala applies to the shell, including the toggle's own label
    await page.getByRole('button', { name: 'සිං' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'si')
    await expect(page.getByRole('button', { name: /අඳුරු ප්‍රකාරයට/ })).toBeVisible()
    await page.getByRole('button', { name: 'EN' }).first().click()

    // Sign out returns to the credentials step with the samithi remembered
    await page.getByRole('button', { name: /signed in|administrator|admin/i }).first().click()
    await page.getByRole('menuitem', { name: /^sign out$/i }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: /sign in to your samithi/i })).toBeVisible()
  })

  test('wrong password shows the translated message; unknown code is rejected', async ({ page }) => {
    await page.goto('login')
    await page.getByLabel(/samithi code/i).fill('ZZZ-0000')
    await page.getByRole('button', { name: /find samithi/i }).click()
    await expect(page.getByRole('alert')).toContainText(/could not find/i)

    await page.getByLabel(/samithi code/i).fill(CODE)
    await page.getByRole('button', { name: /find samithi/i }).click()
    await page.getByLabel(/username/i).fill(USER)
    await page.getByLabel(/^password/i).fill('definitely-wrong')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('alert')).toContainText(/invalid username or password/i)
  })
})
