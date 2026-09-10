import { expect, test } from '@playwright/test'
import { CODE, signIn, uniqueSuffix } from './helpers'

test.describe('settings', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('tabs live in the URL; a general setting saves and restores', async ({ page }) => {
    await signIn(page)
    await page.goto('settings')
    await expect(page.getByRole('heading', { name: /system settings/i })).toBeVisible()

    const threshold = page.getByLabel(/low wallet balance/i)
    await expect(threshold).toBeVisible()
    const original = await threshold.inputValue()
    await threshold.fill(String(Number(original || 0) + 1))
    await page.getByRole('button', { name: /save settings/i }).click()
    await expect(page.getByText(/settings saved successfully/i)).toBeVisible()
    await page.reload()
    await expect(page.getByLabel(/low wallet balance/i)).toHaveValue(String(Number(original || 0) + 1))
    await page.getByLabel(/low wallet balance/i).fill(original)
    await page.getByRole('button', { name: /save settings/i }).click()
    await expect(page.getByText(/settings saved successfully/i)).toBeVisible()

    // Loan rules show the limit in rupees while storing cents
    await page.getByRole('tab', { name: /loan rules/i }).click()
    await expect(page).toHaveURL(/tab=loans/)
    await expect(page.getByText(/currently rs\./i)).toBeVisible()

    // System types: seeded ones are protected
    await page.getByRole('tab', { name: /income types/i }).click()
    await expect(page).toHaveURL(/tab=income/)
    await expect(page.getByRole('table')).toBeVisible()
    await expect(page.getByText('System').first()).toBeVisible()
  })

  test('users: create, reset password and delete a staff login', async ({ page }) => {
    await signIn(page)
    await page.goto('settings?tab=users')
    const username = `e2e${uniqueSuffix()}`.toLowerCase().slice(0, 16)
    await page.getByRole('button', { name: /add user/i }).click()
    const dialog = page.getByRole('dialog', { name: /add user/i })
    await dialog.getByLabel(/full name/i).fill('E2E Temp User')
    await dialog.getByLabel(/username/i).fill(username)
    await dialog.getByLabel(/^password/i).fill('123')
    await dialog.getByRole('button', { name: /create user/i }).click()
    await expect(dialog.getByRole('alert')).toContainText(/at least 4/i)
    await dialog.getByLabel(/^password/i).fill('e2e-temp-pass')
    await dialog.getByLabel(/role/i).selectOption('viewer')
    await dialog.getByRole('button', { name: /create user/i }).click()
    await expect(page.getByText(/created successfully/i)).toBeVisible()

    const row = page.locator(`[data-user="${username}"]`)
    await expect(row).toBeVisible()

    // Admin reset issues a temporary password
    await row.getByRole('button', { name: /reset password/i }).click()
    const reset = page.getByRole('dialog', { name: /reset password/i })
    await reset.getByLabel(/temporary password/i).fill('short')
    await reset.getByRole('button', { name: /^reset password$/i }).click()
    await expect(reset.getByRole('alert')).toContainText(/8 characters/i)
    await reset.getByLabel(/temporary password/i).fill('TempPass2026')
    await reset.getByRole('button', { name: /^reset password$/i }).click()
    await expect(page.getByText(/password reset for/i)).toBeVisible()

    await row.getByRole('button', { name: /delete user/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete user$/i }).click()
    await expect(page.getByText(/deleted successfully/i)).toBeVisible()
    await expect(page.locator(`[data-user="${username}"]`)).toHaveCount(0)
  })

  test('security: this device is listed and password rules are enforced', async ({ page }) => {
    await signIn(page)
    await page.goto('settings?tab=security')
    await expect(page.getByText(/where you are signed in/i)).toBeVisible()
    await expect(page.getByText(/this device/i)).toBeVisible()

    // Validation only — the shared admin password is never actually changed
    await page.getByLabel(/current password/i).fill('admin123')
    await page.getByLabel(/^new password/i).fill('short')
    await page.getByLabel(/confirm new password/i).fill('short')
    await page.getByRole('button', { name: /^change password$/i }).click()
    await expect(page.getByRole('alert')).toContainText(/8 characters/i)
    await page.getByLabel(/^new password/i).fill('longenough1')
    await page.getByLabel(/confirm new password/i).fill('different1')
    await page.getByRole('button', { name: /^change password$/i }).click()
    await expect(page.getByRole('alert')).toContainText(/do not match/i)
  })

  test('about shows both versions and the connected samithi', async ({ page }) => {
    await signIn(page)
    await page.goto('settings?tab=about')
    await expect(page.getByText(/web version/i)).toBeVisible()
    await expect(page.getByText(/api version/i)).toBeVisible()
    const about = page.getByRole('tabpanel')
    await expect(about.getByText(/eSamithi Test Samithi/i)).toBeVisible()
    await expect(about.getByText(CODE)).toBeVisible()
  })
})
