import { expect, test } from '@playwright/test'
import { CODE, signIn } from './helpers'

test.describe('reports', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('monthly, annual and arrears live in the URL and print with a letterhead', async ({ page }) => {
    await signIn(page)
    await page.goto('reports')
    await expect(page.getByRole('heading', { name: /reports/i }).first()).toBeVisible()

    // Monthly: period pickers write to the URL
    await expect(page.getByText(/income by category/i)).toBeVisible()
    await page.getByLabel(/period/i).selectOption('1')
    await expect(page).toHaveURL(/month=1/)
    const years = page.locator('select').last()
    await years.selectOption(String(new Date().getFullYear() - 1))
    await expect(page).toHaveURL(/year=\d{4}/)

    // The printed report carries the society name, the period and ruled tables
    await page.getByRole('button', { name: /^print/i }).click()
    const preview = page.getByRole('dialog').filter({ hasText: /print/i }).first()
    const doc = preview.frameLocator('iframe')
    await expect(doc.getByText(/eSamithi Test Samithi/i)).toBeVisible()
    await expect(doc.getByText(/income by category/i)).toBeVisible()
    await expect(doc.getByText(/treasurer/i)).toBeVisible()
    await preview.getByRole('button', { name: 'Close', exact: true }).first().click()

    // Annual adds the society position
    await page.getByRole('tab', { name: /annual/i }).click()
    await expect(page).toHaveURL(/tab=annual/)
    await expect(page.getByText(/society position/i)).toBeVisible()
    await expect(page.getByText(/total society funds/i)).toBeVisible()

    // Arrears has its own sub-tabs, also in the URL
    await page.getByRole('tab', { name: /arrears/i }).click()
    await expect(page).toHaveURL(/tab=arrears/)
    await expect(page.getByText(/overdue loans/i).first()).toBeVisible()
    await page.getByRole('tab', { name: /fixed deposits|maturing/i }).click()
    await expect(page).toHaveURL(/arrears=fds/)
    await page.getByRole('tab', { name: /fee|unpaid/i }).click()
    await expect(page).toHaveURL(/arrears=members/)

    // CSV export of the visible report
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /export csv/i }).click()])
    expect(download.suggestedFilename()).toMatch(/^arrears-report-/)
  })

  test('the dashboard attention card deep-links into the right arrears tab', async ({ page }) => {
    await signIn(page)
    // Wait for the card's DATA, not just its title: skipping on a still-loading
    // dashboard would hide a broken link behind a green test run
    const attention = page.getByRole('link', { name: /overdue loan|maturing|membership fee/i }).first()
    const allClear = page.getByText(/nothing needs your attention/i)
    await expect(attention.or(allClear).first()).toBeVisible()
    const hasAttention = await attention.isVisible()
    test.skip(!hasAttention, 'nothing needs attention on this tenant')
    await attention.click()
    await expect(page).toHaveURL(/tab=arrears/)
    await expect(page).toHaveURL(/arrears=overdue/)
    await expect(page.getByText(/overdue loans/i).first()).toBeVisible()
  })
})
