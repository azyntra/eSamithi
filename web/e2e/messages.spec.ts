import { expect, test } from '@playwright/test'
import { CODE, signIn, uniqueSuffix } from './helpers'

test.describe('messages', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('announcement lifecycle: publish, edit, hide, delete', async ({ page }) => {
    const title = `E2E Notice ${uniqueSuffix()}`
    await signIn(page)
    await page.goto('messages')
    await expect(page.getByRole('tab', { name: /announcements/i })).toHaveAttribute('data-state', 'active')

    await page.getByRole('button', { name: /new announcement/i }).first().click()
    const sheet = page.getByRole('dialog')

    // A death notice needs the name of the deceased before it can go out
    await sheet.getByLabel(/^type/i).selectOption('death')
    await sheet.getByLabel(/^title/i).fill(title)
    await sheet.getByRole('button', { name: /^publish$/i }).click()
    await expect(sheet.getByRole('alert')).toContainText(/name of the deceased/i)

    // A meeting needs its date
    await sheet.getByLabel(/^type/i).selectOption('meeting')
    await sheet.getByRole('button', { name: /^publish$/i }).click()
    await expect(sheet.getByRole('alert')).toContainText(/meeting date/i)

    await sheet.getByLabel(/^type/i).selectOption('general')
    await sheet.getByLabel(/details/i).fill('Published by the end-to-end suite.')
    await sheet.getByRole('button', { name: /^publish$/i }).click()
    await expect(page.getByText(/announcement published/i)).toBeVisible()

    const card = page.locator('[data-announcement]').filter({ hasText: title })
    await expect(card).toBeVisible()
    await expect(card).toContainText(/general/i)

    // Edit keeps the same notice
    await card.getByRole('button', { name: new RegExp(`edit: ${title}`, 'i') }).click()
    const edited = `${title} (edited)`
    await page.getByRole('dialog').getByLabel(/^title/i).fill(edited)
    await page.getByRole('dialog').getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByText(/announcement updated/i)).toBeVisible()
    const editedCard = page.locator('[data-announcement]').filter({ hasText: edited })
    await expect(editedCard).toBeVisible()

    // Hide takes it out of the member app without deleting it
    await editedCard.getByRole('button', { name: new RegExp(`hide: ${edited.replace(/[()]/g, '\\$&')}`, 'i') }).click()
    await expect(page.getByText(/hidden from the member app/i)).toBeVisible()
    await expect(editedCard.getByText(/^hidden$/i)).toBeVisible()
    await editedCard.getByRole('button', { name: new RegExp(`show: ${edited.replace(/[()]/g, '\\$&')}`, 'i') }).click()
    await expect(page.getByText(/visible in the member app/i)).toBeVisible()

    await editedCard.getByRole('button', { name: new RegExp(`delete: ${edited.replace(/[()]/g, '\\$&')}`, 'i') }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText(/announcement deleted/i)).toBeVisible()
    await expect(page.locator('[data-announcement]').filter({ hasText: edited })).toHaveCount(0)
  })

  test('requests and puruka tabs are deep-linkable', async ({ page }) => {
    await signIn(page)
    await page.goto('messages?tab=requests')
    await expect(page.getByRole('tab', { name: /member requests/i })).toHaveAttribute('data-state', 'active')

    // The queue defaults to pending; switching to all is a distinct URL
    const pending = page.getByRole('tab', { name: /^pending$/i })
    await expect(pending).toHaveAttribute('data-state', 'active')
    await page.getByRole('tab', { name: /^all$/i }).click()
    await expect(page).toHaveURL(/status=all/)
    const requestCards = page.locator('[data-request]')
    const noRequests = page.getByText(/no requests/i)
    await expect(requestCards.first().or(noRequests)).toBeVisible()

    await page.goto('messages?tab=puruka')
    await expect(page.getByRole('tab', { name: /puruka/i })).toHaveAttribute('data-state', 'active')
    await expect(page.getByRole('heading', { name: /puruka categories/i })).toBeVisible()
    const table = page.getByRole('table')
    await expect(table).not.toHaveAttribute('aria-busy', 'true')
    await page.getByLabel(/reported only/i).check()
    await expect(table).not.toHaveAttribute('aria-busy', 'true')
    // A testbed may have no reported posts at all; either outcome is correct
    await expect(table.locator('tbody tr:not([data-skeleton])').first().or(page.getByText(/no puruka posts found/i))).toBeVisible()
  })
})
