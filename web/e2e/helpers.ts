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

// The testbed's wallet balances are whatever earlier runs left behind, and a
// spec that has to disburse money should fail only for reasons it is testing.
// Money arrives the way it really does, as a recorded income: the deposit
// button exists only in migration mode, so it is not an option here.
export async function fundFirstWallet(page: Page, rupees = 5000): Promise<string> {
  await page.goto('incomes?create=1')
  const sheet = page.getByRole('dialog')
  await expect(sheet.getByRole('heading', { name: /record income/i })).toBeVisible()
  await chooseType(page, /income type/i)
  const payerType = sheet.getByLabel(/payer type/i)
  if (await payerType.isVisible().catch(() => false)) {
    await payerType.selectOption('Guest')
    await sheet.getByLabel(/payer name/i).fill('E2E Float')
  }
  await sheet.getByLabel(/amount/i).fill(String(rupees))
  const wallet = sheet.getByLabel(/deposit to wallet/i)
  await expect(wallet.locator('option').nth(1)).toBeAttached()
  await wallet.selectOption({ index: 1 })
  // The ledger labels a wallet "Name · Rs. 1,234.00"; other screens show the
  // bare name, so hand back the part they agree on.
  const label = await wallet.evaluate((el: HTMLSelectElement) => el.options[el.selectedIndex]!.text)
  const notes = sheet.getByLabel(/description|notes/i)
  if (await notes.isVisible().catch(() => false)) await notes.fill('E2E float for the loan test')
  await sheet.getByRole('button', { name: /^record income$/i }).click()
  await expect(page.getByText(/income recorded successfully/i)).toBeVisible()
  return label.split('·')[0]!.trim()
}

export async function chooseType(page: Page, label: RegExp) {
  const select = page.getByRole('dialog').getByLabel(label)
  // Types load asynchronously; the select is disabled (aria-busy) until then
  await expect(select).toBeEnabled()
  await expect(select.locator('option').nth(1)).toBeAttached()
  const options = (await select.locator('option').allTextContents()).map((o) => o.trim())
  const other = options.find((o) => /^other\b/i.test(o)) ?? options[options.length - 1]!
  await select.selectOption({ label: other })
  return other
}

export async function chooseFundedWallet(page: Page, label: RegExp) {
  const select = page.getByRole('dialog').getByLabel(label)
  await expect(select.locator('option').nth(1)).toBeAttached()
  const options = (await select.locator('option').allTextContents()).map((o) => o.trim())
  // "Name · Rs. 1,234.00" → pick the richest wallet
  const funded = options
    .map((o) => ({ o, v: Number((o.match(/Rs\.\s*([\d,]+\.\d{2})/)?.[1] ?? '0').replace(/,/g, '')) }))
    .filter((x) => x.o.trim())
    .sort((a, b) => b.v - a.v)[0]!
  await select.selectOption({ label: funded.o })
}
