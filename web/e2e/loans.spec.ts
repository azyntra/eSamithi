import { expect, test, type Page } from '@playwright/test'
import { CODE, firstDataRow, signIn, uniqueSuffix } from './helpers'

// The member picker is a combobox with a searchable list
async function pickMember(page: Page, label: RegExp, name: string) {
  await page.getByRole('dialog').getByRole('combobox', { name: label }).click()
  const listbox = page.getByRole('dialog').last()
  await listbox.getByRole('option', { name: new RegExp(name, 'i') }).click()
}
async function memberOptions(page: Page, label: RegExp): Promise<string[]> {
  await page.getByRole('dialog').getByRole('combobox', { name: label }).click()
  // Scope to the listbox that just opened: native <select> elements also
  // expose role=listbox/option, so take the last (top-most) one.
  const listbox = page.getByRole('listbox').last()
  await expect(listbox).toBeVisible()
  const options = await listbox.getByRole('option').allTextContents()
  await page.keyboard.press('Escape')
  await expect(listbox).toBeHidden()
  return options
}

test.describe('loans', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('portfolio sorts by member ID by default and searches', async ({ page }) => {
    await signIn(page)
    await page.goto('loans')
    await expect(page.getByRole('heading', { name: /loan portfolio/i })).toBeVisible()
    const row = await firstDataRow(page)
    await expect(row).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /member \(applicant\)/i })).toHaveAttribute('aria-sort', 'ascending')

    // Sorting by balance flips into the URL and back
    await page.getByRole('button', { name: /balance owed/i }).click()
    await expect(page).toHaveURL(/sort=balance/)
    await page.getByRole('button', { name: /balance owed/i }).click()
    await expect(page).toHaveURL(/dir=asc/)

    const name = (await (await firstDataRow(page)).locator('td').nth(1).innerText()).trim().split('\n')[0]!
    await page.getByRole('textbox', { name: /search/i }).fill(name.slice(0, 5))
    await expect(page).toHaveURL(/q=/)
    await expect(await firstDataRow(page)).toContainText(name.slice(0, 5))
  })

  test('issue, inspect, repay, print and delete a loan', async ({ page }) => {
    await signIn(page)
    await page.goto('loans')
    await firstDataRow(page)
    // Tag this run's loan so a leftover from an earlier run can never match
    const tag = `E2E loan ${uniqueSuffix()}`

    // A member with no open loan, so the headroom is the full limit
    await page.getByRole('button', { name: /issue new loan/i }).first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: /issue new loan/i })).toBeVisible()
    await pickMember(page, /applicant member/i, 'Madusanka')

    // The borrower can never be offered as their own guarantor
    const g1Options = await memberOptions(page, /guarantor 1/i)
    expect(g1Options.join(' ')).not.toMatch(/Madusanka/i)

    await pickMember(page, /guarantor 1/i, 'Sachira')
    // …nor can a guarantor be picked twice
    const g2Options = await memberOptions(page, /guarantor 2/i)
    expect(g2Options.join(' ')).not.toMatch(/Sachira/i)
    await pickMember(page, /guarantor 2/i, 'Test Member')

    await sheet.getByLabel(/principal amount/i).fill('10')
    await sheet.getByLabel(/disbursement wallet/i).selectOption({ index: 1 })
    await sheet.getByLabel(/purpose of loan/i).fill(tag)
    await expect(sheet.getByText(/available headroom/i)).toBeVisible()
    await sheet.getByRole('button', { name: /issue loan & disburse/i }).click()
    await expect(page.getByText(/loan issued successfully/i)).toBeVisible()

    // Open its detail page
    const row = page.getByRole('table').locator('tbody tr:not([data-skeleton])').filter({ hasText: tag }).first()
    await expect(row).toBeVisible()
    await row.getByRole('link').first().click()
    await expect(page).toHaveURL(/\/loans\/\d+$/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Madusanka')
    await expect(page.getByText(/guarantors \(2\)/i)).toBeVisible()
    await expect(page.getByText(/no repayments recorded/i)).toBeVisible()

    // Repay part of it: the waterfall preview must add up to the amount
    await page.getByRole('button', { name: /record repayment/i }).first().click()
    const repay = page.getByRole('dialog', { name: /record loan repayment/i })
    await repay.getByLabel(/repayment amount/i).fill('4')
    await expect(repay.getByText(/automatic allocation/i)).toBeVisible()
    await repay.getByLabel(/deposit to wallet/i).selectOption({ index: 1 })
    await repay.getByRole('button', { name: /record repayment/i }).click()
    await expect(page.getByText(/repayment recorded successfully/i)).toBeVisible()
    await expect(page.getByText(/repayment history \(1\)/i)).toBeVisible()

    // Receipt and statement previews carry the frozen numbering series
    await page.getByRole('row').filter({ hasText: 'Rs. 4.00' }).first().getByRole('button', { name: /print receipt/i }).click()
    const receipt = page.getByRole('dialog', { name: /print receipt/i })
    await expect(receipt.frameLocator('iframe').getByText(/LNP-\d{5}/)).toBeVisible()
    await receipt.getByRole('button', { name: 'Close', exact: true }).first().click()
    await page.getByRole('button', { name: /print statement/i }).click()
    const statement = page.getByRole('dialog', { name: /print statement/i })
    await expect(statement.frameLocator('iframe').getByText(/LN-\d{5}/)).toBeVisible()
    await expect(statement.frameLocator('iframe').getByText(/Rs\. 6\.00/).first()).toBeVisible()
    await statement.getByRole('button', { name: 'Close', exact: true }).first().click()

    // Deleting reverses everything and needs the member ID typed
    await page.getByRole('button', { name: /delete loan permanently/i }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm.getByRole('button', { name: /delete loan permanently/i })).toBeDisabled()
    await confirm.getByRole('textbox').fill('003')
    await confirm.getByRole('button', { name: /delete loan permanently/i }).click()
    await expect(page.getByText(/loan permanently deleted/i)).toBeVisible()
    await expect(page).toHaveURL(/\/loans\/?(\?.*)?$/)
    await expect(page.getByRole('table').locator('tbody tr').filter({ hasText: tag })).toHaveCount(0)
  })
})
