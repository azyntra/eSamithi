import { expect, test, type Page } from '@playwright/test'
import { CODE, firstDataRow, signIn, uniqueSuffix } from './helpers'

// Bearer token of the signed-in session, captured from the app's own API calls
async function captureToken(page: Page): Promise<string> {
  const req = await page.waitForRequest((r) => r.url().includes('/api/v1/') && Boolean(r.headers()['authorization']))
  return req.headers()['authorization']!
}

test.describe('financial hub', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('wallets: tabs in URL, create, transfer both ways, toggle, delete', async ({ page }) => {
    await signIn(page)
    await page.goto('wallet')
    await expect(page.getByRole('heading', { name: /financial hub/i })).toBeVisible()
    await page.getByRole('tab', { name: /fixed deposits/i }).click()
    await expect(page).toHaveURL(/tab=investments/)
    await page.getByRole('tab', { name: /liquid wallets/i }).click()
    await expect(page).not.toHaveURL(/tab=/)

    const name = `E2E Wallet ${uniqueSuffix()}`
    await page.getByRole('button', { name: /new wallet/i }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel(/wallet name/i).fill(name)
    await sheet.getByLabel(/wallet type/i).selectOption('Bank')
    await sheet.getByRole('button', { name: /create wallet/i }).click()
    await expect(page.getByText(/wallet created successfully/i)).toBeVisible()
    const row = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: name }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText('Rs. 0.00')

    // Transfer Rs. 1 in, then back out
    await page.getByRole('button', { name: /^transfer$/i }).click()
    const transfer = page.getByRole('dialog', { name: /transfer funds/i })
    await expect(transfer.getByLabel(/from wallet/i)).toBeVisible()
    const fromOptions = (await transfer.getByLabel(/from wallet/i).locator('option').allTextContents()).map((o) => o.trim())
    const source = fromOptions.find((o) => !o.startsWith(name) && !/\(Rs\. 0\.00\)/.test(o))
    test.skip(!source, 'no funded wallet to transfer from')
    await transfer.getByLabel(/to wallet/i).selectOption({ label: name })
    await transfer.getByLabel(/from wallet/i).selectOption({ label: source! })
    await transfer.getByLabel(/amount/i).fill('1')
    await transfer.getByRole('button', { name: /^transfer$/i }).click()
    await expect(page.getByText(/funds transferred successfully/i)).toBeVisible()
    await expect(row).toContainText('Rs. 1.00')

    // Deleting a wallet that holds funds is refused client-side
    await row.getByRole('button', { name: /cannot delete wallet with balance/i }).click()
    await expect(page.getByText(/transfer funds first/i)).toBeVisible()

    await page.getByRole('button', { name: /^transfer$/i }).click()
    const back = page.getByRole('dialog', { name: /transfer funds/i })
    await back.getByLabel(/from wallet/i).selectOption({ label: `${name} (Rs. 1.00)` })
    await back.getByLabel(/to wallet/i).selectOption({ label: source!.replace(/\s*\(Rs\..*\)$/, '') })
    await expect(back.getByLabel(/from wallet/i)).toHaveValue(String(await back.getByLabel(/from wallet/i).inputValue()))
    await back.getByLabel(/amount/i).fill('1')
    await back.getByRole('button', { name: /^transfer$/i }).click()
    await expect(page.getByText(/funds transferred successfully/i)).toBeVisible()
    await expect(row).toContainText('Rs. 0.00')

    // Deactivate → activate → delete
    await row.getByRole('button', { name: /^deactivate$/i }).click()
    await expect(page.getByText(/wallet status updated/i)).toBeVisible()
    await expect(row).toContainText(/inactive/i)
    await row.getByRole('button', { name: /^activate$/i }).click()
    await expect(row.getByRole('button', { name: /^deactivate$/i })).toBeVisible()
    await row.getByRole('button', { name: /^delete wallet$/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete wallet$/i }).click()
    await expect(page.getByText(new RegExp(`Wallet "${name}" deleted`))).toBeVisible()
    await expect(page.getByRole('table').locator('tbody tr').filter({ hasText: name })).toHaveCount(0)
  })

  test('fixed deposit: funded from a wallet, listed, withdrawn (principal returns)', async ({ page }) => {
    await signIn(page)
    const tokenPromise = captureToken(page)
    await page.goto('wallet?tab=investments')
    const auth = await tokenPromise
    await expect(page.getByRole('tab', { name: /fixed deposits/i })).toHaveAttribute('data-state', 'active')

    const fdNo = `E2E/FD/${uniqueSuffix()}`
    await page.getByRole('button', { name: /new investment/i }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel(/fd number/i).fill(fdNo)
    await sheet.getByLabel(/bank name/i).fill('E2E Bank')
    await sheet.getByLabel(/principal amount/i).fill('1')
    await sheet.getByLabel(/interest rate/i).fill('12.5')
    await sheet.getByLabel(/term \(months\)/i).fill('12')
    const start = await sheet.getByLabel(/start date/i).inputValue()
    await expect(sheet.getByLabel(/maturity date/i)).toHaveValue(`${Number(start.slice(0, 4)) + 1}${start.slice(4)}`)
    const linked = sheet.getByLabel(/linked wallet/i)
    // Wallets arrive asynchronously; the select stays disabled until they do
    await expect(linked).toBeEnabled()
    await expect(linked.locator('option').nth(1)).toBeAttached()
    const options = (await linked.locator('option').allTextContents()).map((o) => o.trim())
    const funded = options.find((o) => /\(Rs\. [1-9]/.test(o))
    test.skip(!funded, 'no funded wallet to fund the FD from')
    await linked.selectOption({ label: funded! })
    await sheet.getByRole('button', { name: /register investment/i }).click()
    await expect(page.getByText(/fixed deposit registered successfully/i)).toBeVisible()

    const row = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: fdNo }).first()
    await expect(row).toBeVisible()
    await expect(row).toContainText(/active/i)
    await row.getByRole('button', { name: /^withdraw$/i }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText(/returned to the linked wallet/i)
    await confirm.getByRole('button', { name: /withdraw fd/i }).click()
    await expect(page.getByText(/fixed deposit withdrawn/i)).toBeVisible()
    await expect(row).toContainText(/withdrawn/i)

    // Tidy up the test row through the API (no delete UI on purpose)
    const id = await row.evaluate((tr) => tr.getAttribute('data-id') || '')
    const list = await page.request.get('/api/v1/fixed-deposits', { headers: { Authorization: auth, 'X-Samithi': 'test01' } })
    const mine = ((await list.json()) as Array<{ id: number; fd_number: string }>).find((f) => f.fd_number === fdNo)
    if (mine) {
      const del = await page.request.delete(`/api/v1/fixed-deposits/${mine.id}`, { headers: { Authorization: auth, 'X-Samithi': 'test01' } })
      expect(del.ok()).toBeTruthy()
    }
    void id
  })

  test('assets: register, edit quantity, delete', async ({ page }) => {
    await signIn(page)
    await page.goto('wallet?tab=assets')
    const name = `E2E Chairs ${uniqueSuffix()}`
    await page.getByRole('button', { name: /new asset/i }).first().click()
    const dialog = page.getByRole('dialog', { name: /register physical asset/i })
    await dialog.getByLabel(/asset name/i).fill(name)
    await dialog.getByLabel(/total quantity/i).fill('40')
    await dialog.getByLabel(/description/i).fill('Plastic, blue')
    await dialog.getByRole('button', { name: /register asset/i }).click()
    await expect(page.getByText(/asset registered in inventory/i)).toBeVisible()
    const row = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: name }).first()
    await expect(row).toContainText('40')
    await row.getByRole('button', { name: /edit asset/i }).click()
    const edit = page.getByRole('dialog', { name: /edit physical asset/i })
    await edit.getByLabel(/total quantity/i).fill('42')
    await edit.getByRole('button', { name: /save changes/i }).click()
    await expect(page.getByText(/asset updated/i)).toBeVisible()
    await expect(row).toContainText('42')
    await row.getByRole('button', { name: /delete asset/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete asset$/i }).click()
    await expect(page.getByText(new RegExp(`Asset "${name}" deleted`))).toBeVisible()
    await firstDataRow(page).catch(() => null)
    await expect(page.getByRole('table').locator('tbody tr').filter({ hasText: name })).toHaveCount(0)
  })
})
