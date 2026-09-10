import { expect, test } from '@playwright/test'
import { CODE, signIn } from './helpers'

test.describe('command palette', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('opens with the keyboard, jumps to a page and finds a member', async ({ page }) => {
    await signIn(page)

    // ⌘K / Ctrl+K from anywhere
    await page.keyboard.press('ControlOrMeta+k')
    const palette = page.getByRole('dialog')
    const input = palette.getByPlaceholder(/search members, pages and actions/i)
    await expect(input).toBeVisible()

    // Navigation
    await input.fill('reports')
    await palette.getByRole('option', { name: /reports/i }).first().click()
    await expect(page).toHaveURL(/\/reports/)

    // The same shortcut closes it again
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByPlaceholder(/search members, pages and actions/i)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByPlaceholder(/search members, pages and actions/i)).toHaveCount(0)

    // A member search opens that member's profile
    await page.getByRole('button', { name: /^search/i }).first().click()
    const input2 = page.getByPlaceholder(/search members, pages and actions/i)
    await input2.fill('001')
    const memberOption = page.getByRole('option').filter({ hasText: '001' }).first()
    await expect(memberOption).toBeVisible()
    await memberOption.click()
    await expect(page).toHaveURL(/\/members\/\d+/)
  })

  test('quick actions are links a page honours', async ({ page }) => {
    await signIn(page)

    // Straight to the URL a quick action produces
    await page.goto('incomes?create=1')
    await expect(page.getByRole('dialog').getByText(/record income/i).first()).toBeVisible()
    // The flag is consumed so a reload does not reopen the form
    await expect(page).not.toHaveURL(/create=1/)

    await page.goto('members?scan=1')
    await expect(page.getByRole('dialog')).toContainText(/scan/i)
    await page.keyboard.press('Escape')

    await page.goto('attendance?create=1')
    await expect(page.getByRole('dialog', { name: /new event/i })).toBeVisible()
    await page.keyboard.press('Escape')

    // And through the palette itself
    await page.keyboard.press('ControlOrMeta+k')
    await page.getByPlaceholder(/search members, pages and actions/i).fill('announcement')
    await page.getByRole('option', { name: /new announcement/i }).click()
    await expect(page).toHaveURL(/\/messages/)
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})
