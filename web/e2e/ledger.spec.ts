import { expect, test, type Page } from '@playwright/test'
import { chooseFundedWallet, chooseType, CODE, firstDataRow, signIn, uniqueSuffix } from './helpers'

test.describe('ledger', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('incomes: filters in URL, record → print preview → void → delete, CSV export', async ({ page }) => {
    await signIn(page)
    await page.goto('incomes')
    await expect(page.getByRole('heading', { name: /income ledger/i })).toBeVisible()

    // Filters live in the URL
    await page.getByLabel(/date range/i).selectOption('this_month')
    await expect(page).toHaveURL(/from=\d{4}-\d{2}-01/)
    await page.getByLabel(/date range/i).selectOption('all')
    await expect(page).not.toHaveURL(/from=/)

    // Record an income (guest payer where the type allows it)
    await page.getByRole('button', { name: /record income/i }).click()
    const sheet = page.getByRole('dialog')
    const typeName = await chooseType(page, /income type/i)
    const payerType = sheet.getByLabel(/payer type/i)
    if (await payerType.isVisible().catch(() => false)) {
      await payerType.selectOption('Guest')
      await sheet.getByLabel(/payer name/i).fill('E2E Guest')
    }
    await sheet.getByLabel(/amount/i).fill('250')
    await sheet.getByLabel(/deposit to wallet/i).selectOption({ index: 1 })
    const notes = sheet.getByLabel(/description|notes/i)
    await notes.fill('E2E income entry')
    await sheet.getByRole('button', { name: /^record income$/i }).click()
    await expect(page.getByText(/income recorded successfully/i)).toBeVisible()

    // Toast action opens the receipt preview with the INC- number
    await page.getByRole('button', { name: /print receipt/i }).first().click()
    const preview = page.getByRole('dialog', { name: /print receipt/i })
    await expect(preview).toBeVisible()
    const frame = preview.frameLocator('iframe')
    await expect(frame.getByText(/INC-\d{5}/)).toBeVisible()
    await expect(frame.getByText(typeName.trim())).toBeVisible()
    await preview.getByRole('button', { name: 'Close', exact: true }).first().click()

    // The new row is first; void it, then delete it permanently
    const row = await firstDataRow(page)
    await expect(row).toContainText('E2E income entry')
    await row.getByRole('button', { name: /void transaction/i }).click()
    const voidDialog = page.getByRole('dialog', { name: /void transaction/i })
    await expect(voidDialog.getByRole('button', { name: /confirm void/i })).toBeDisabled()
    await voidDialog.getByLabel(/reason/i).fill('E2E test entry')
    await voidDialog.getByRole('button', { name: /confirm void/i }).click()
    await expect(page.getByText(/voided and funds reversed/i)).toBeVisible()
    const voided = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: 'E2E income entry' }).first()
    await expect(voided).toContainText(/void/i)
    await voided.getByRole('button', { name: /delete transaction permanently/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /delete permanently/i }).click()
    await expect(page.getByText(/permanently deleted/i)).toBeVisible()

    // CSV export downloads a BOM-prefixed file named by date
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /export csv/i }).click()])
    expect(download.suggestedFilename()).toMatch(/^income-ledger-\d{4}-\d{2}-\d{2}\.csv$/)
    const path = await download.path()
    const fs = await import('node:fs')
    const text = fs.readFileSync(path!, 'utf8')
    expect(text.charCodeAt(0)).toBe(0xfeff)
    expect(text.slice(1).split(/\r?\n/)[0]).toMatch(/^Date,Payer,NIC,Type/)
  })

  test('expenses: record against a funded wallet, insufficient funds is caught, void and delete', async ({ page }) => {
    await signIn(page)
    await page.goto('expenses')
    await expect(page.getByRole('heading', { name: /expense ledger/i })).toBeVisible()
    await page.getByRole('button', { name: /record expense/i }).click()
    const sheet = page.getByRole('dialog')
    await chooseType(page, /expense type/i)
    const recipientType = sheet.getByLabel(/recipient type/i)
    if (await recipientType.isVisible().catch(() => false)) await recipientType.selectOption('Vendor')
    const payee = sheet.getByLabel(/payee/i).first()
    if (await payee.isVisible().catch(() => false)) await payee.fill('E2E Hardware Store')
    await chooseFundedWallet(page, /deduct from wallet/i)

    // Client-side balance guard
    await sheet.getByLabel(/amount/i).fill('99999999')
    await sheet.getByLabel(/description|notes/i).fill('E2E expense entry')
    await sheet.getByRole('button', { name: /^record expense$/i }).click()
    await expect(sheet.getByText(/insufficient funds/i)).toBeVisible()

    await sheet.getByLabel(/amount/i).fill('10')
    await sheet.getByRole('button', { name: /^record expense$/i }).click()
    await expect(page.getByText(/expense recorded successfully/i)).toBeVisible()

    const row = await firstDataRow(page)
    await expect(row).toContainText('E2E expense entry')
    await row.getByRole('button', { name: /void transaction/i }).click()
    const voidDialog = page.getByRole('dialog', { name: /void transaction/i })
    await voidDialog.getByLabel(/reason/i).fill('E2E test entry')
    await voidDialog.getByRole('button', { name: /confirm void/i }).click()
    await expect(page.getByText(/voided and funds refunded/i)).toBeVisible()
    const voided = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: 'E2E expense entry' }).first()
    await voided.getByRole('button', { name: /delete transaction permanently/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /delete permanently/i }).click()
    await expect(page.getByText(/permanently deleted/i)).toBeVisible()
  })

  test('record payment from Member 360 pre-selects the member', async ({ page }) => {
    await signIn(page)
    await page.goto('members')
    const first = await firstDataRow(page)
    const name = (await first.locator('td').nth(1).innerText()).trim().split('\n')[0]!
    await first.getByRole('link').first().click()
    await page.getByRole('button', { name: /record payment/i }).click()
    await expect(page).toHaveURL(/\/incomes$/)
    const sheet = page.getByRole('dialog')
    await expect(sheet).toBeVisible()
    const select = sheet.getByLabel(/income type/i)
    await expect(select).toBeEnabled()
    await expect(select.locator('option').nth(1)).toBeAttached()
    const options = (await select.locator('option').allTextContents()).map((o) => o.trim())
    const memberType = options.find((o) => /membership|entrance|fine/i.test(o))
    test.skip(!memberType, 'no member-bound income type on this tenant')
    await select.selectOption({ label: memberType! })
    await expect(sheet.getByRole('combobox', { name: /^member$/i })).toContainText(name.slice(0, 6))
  })
})
