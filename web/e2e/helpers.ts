import { expect, type Page } from '@playwright/test'

export const CODE = process.env.E2E_SAMITHI_CODE || ''
export const USER = process.env.E2E_USER || 'admin'
export const PASS = process.env.E2E_PASS || 'admin123'

// Join code → credentials → dashboard. Shared by every authenticated spec.
export async function signIn(page: Page): Promise<void> {
  await page.goto('login')
  // Fresh contexts start at the samithi-code step; a remembered samithi skips it
  const codeField = page.getByLabel(/samithi code/i)
  const userField = page.getByLabel(/username/i)
  await codeField.or(userField).first().waitFor()
  if (await codeField.isVisible()) {
    await codeField.fill(CODE)
    await page.getByRole('button', { name: /find samithi/i }).click()
  }
  await page.getByLabel(/username/i).fill(USER)
  await page.getByLabel(/^password/i).fill(PASS)
  await page.getByRole('button', { name: /^sign in$/i }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export const uniqueSuffix = (): string => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase()

// Data tables render skeleton rows while loading; wait for a real row.
export async function firstDataRow(page: Page) {
  const table = page.getByRole('table')
  await expect(table).not.toHaveAttribute('aria-busy', 'true')
  const row = table.locator('tbody tr:not([data-skeleton])').first()
  await expect(row).toBeVisible()
  return row
}
