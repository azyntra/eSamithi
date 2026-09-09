import { expect, test } from '@playwright/test'
import { CODE, firstDataRow, signIn, uniqueSuffix } from './helpers'

test.describe('members', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('list, search, open a profile and switch tabs', async ({ page }) => {
    await signIn(page)
    await page.getByRole('link', { name: /member registry/i }).click()
    await expect(page).toHaveURL(/\/members\/?$/)
    await expect(page.getByRole('heading', { name: /member registry/i })).toBeVisible()
    const firstRow = await firstDataRow(page)
    const name = (await firstRow.locator('td').nth(1).innerText()).trim().split('\n')[0]!

    // URL-bound search
    await page.getByRole('textbox', { name: /search/i }).fill(name.slice(0, 4))
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(name.slice(0, 4)).replace(/%20/g, '(%20|\\\\+)')}`, 'i'))
    await expect((await firstDataRow(page))).toContainText(name.slice(0, 4))

    // Open Member 360 and walk the tabs
    await (await firstDataRow(page)).getByRole('link').first().click()
    await expect(page).toHaveURL(/\/members\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name.slice(0, 4))
    await page.getByRole('tab', { name: /statement/i }).click()
    await expect(page).toHaveURL(/tab=statement/)
    await expect(page.getByText(/payments made/i)).toBeVisible()
    await page.getByRole('tab', { name: /dependents/i }).click()
    await page.getByRole('tab', { name: /mobile app/i }).click()
    await expect(page.getByText(/app access/i)).toBeVisible()
    await page.getByRole('link', { name: /all members/i }).click()
    await expect(page).toHaveURL(/\/members\/?$/)
  })

  test('create, edit and delete a member with the typed confirmation', async ({ page }) => {
    await signIn(page)
    await page.goto('members')
    const sid = `E2E-${uniqueSuffix()}`
    await page.getByRole('button', { name: /add new member/i }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByLabel(/society id number/i).fill(sid)
    await sheet.getByLabel(/national id/i).fill(`${Date.now()}V`.slice(-12))
    await sheet.getByLabel(/full name/i).first().fill(`E2E Member ${sid}`)
    await sheet.getByLabel(/phone number/i).fill('12345')
    await sheet.getByRole('button', { name: /save member/i }).click()
    await expect(sheet.getByText(/exactly 10 digits/i)).toBeVisible()
    await sheet.getByLabel(/phone number/i).fill('0771234567')
    await sheet.getByRole('button', { name: /add dependent/i }).click()
    await sheet.getByLabel(/full name/i).nth(1).fill('Child One')
    await sheet.getByLabel(/relationship/i).fill('Child')
    await sheet.getByRole('button', { name: /save member/i }).click()
    await expect(page.getByText(/member added successfully/i)).toBeVisible()

    // Duplicate society ID is rejected inline
    await page.getByRole('button', { name: /add new member/i }).click()
    await page.getByRole('dialog').getByLabel(/society id number/i).fill(sid)
    await page.getByRole('dialog').getByLabel(/national id/i).click()
    await expect(page.getByRole('dialog').getByText(/already exists/i)).toBeVisible()
    await page.keyboard.press('Escape')
    const discard = page.getByRole('alertdialog')
    if (await discard.isVisible().catch(() => false)) await discard.getByRole('button', { name: /^discard$/i }).click()

    // Find it, edit the occupation, verify on the profile
    await page.getByRole('textbox', { name: /search/i }).fill(sid)
    const row = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: sid }).first()
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /edit member/i }).click()
    const edit = page.getByRole('dialog')
    await expect(edit.getByLabel(/society id number/i)).toHaveValue(sid)
    await edit.getByLabel(/job \/ occupation/i).fill('Farmer')
    await edit.getByRole('button', { name: /update member/i }).click()
    await expect(page.getByText(/member updated successfully/i)).toBeVisible()
    await row.getByRole('link').first().click()
    await expect(page.getByText('Farmer')).toBeVisible()
    await page.getByRole('tab', { name: /dependents/i }).click()
    await expect(page.getByText('Child One')).toBeVisible()

    // Delete needs the society ID typed
    await page.getByRole('button', { name: /delete member/i }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.getByRole('button', { name: /^delete$/i })).toBeDisabled()
    await confirm.getByRole('textbox').fill(sid)
    await confirm.getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText(/member deleted/i)).toBeVisible()
    await expect(page).toHaveURL(/\/members\/?$/)
    await page.getByRole('textbox', { name: /search/i }).fill(sid)
    await expect(page.getByText(/no members found/i)).toBeVisible()
  })

  test('scan card finds a member by exact society ID', async ({ page }) => {
    await signIn(page)
    await page.goto('members')
    const first = await firstDataRow(page)
    const sid = (await first.locator('td').first().innerText()).trim()
    await page.getByRole('button', { name: /scan card/i }).click()
    await page.getByRole('dialog').getByRole('textbox').fill(sid)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/members\/\d+$/)
    await expect(page.getByText(`#${sid}`)).toBeVisible()
  })
})
