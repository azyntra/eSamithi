import { expect, test } from '@playwright/test'
import { CODE, firstDataRow, signIn, uniqueSuffix } from './helpers'

test.describe('attendance', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('event lifecycle: create, mark, scan, switch method, delete', async ({ page }) => {
    const title = `E2E Meeting ${uniqueSuffix()}`
    await signIn(page)
    await page.goto('attendance')

    // Create — the marking method is chosen up front
    await page.getByRole('button', { name: /new event/i }).first().click()
    const dialog = page.getByRole('dialog', { name: /new event/i })
    await dialog.getByLabel(/^title/i).fill(title)
    await dialog.getByRole('button', { name: /create event/i }).click()
    await expect(page.getByText(/event created/i)).toBeVisible()

    // The new event is selected and the selection lives in the URL
    await expect(page).toHaveURL(/[?&]event=\d+/)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    const presentTab = page.getByRole('tab', { name: /^present/i })
    const absentTab = page.getByRole('tab', { name: /^absent/i })
    const countOf = async (tab: typeof presentTab) => Number(((await tab.innerText()).match(/\((\d+)\)/) ?? [])[1] ?? -1)

    // Everyone starts absent in "mark those present" mode
    expect(await countOf(presentTab)).toBe(0)
    const roster = await countOf(absentTab)
    expect(roster).toBeGreaterThan(0)

    // Mark one member off the absent list — an absentee cannot scan their card
    await absentTab.click()
    await expect(page).toHaveURL(/view=absent/)
    const row = await firstDataRow(page)
    const societyId = (await row.locator('td').first().innerText()).trim()
    const name = (await row.locator('td').nth(1).innerText()).trim()
    await row.getByRole('button', { name: new RegExp(`^mark: ${name}`, 'i') }).click()
    await expect.poll(() => countOf(presentTab)).toBe(1)
    await expect.poll(() => countOf(absentTab)).toBe(roster - 1)

    // Scanning the same card again is a duplicate, not a second mark
    await page.getByRole('textbox', { name: /scan a card/i }).fill(societyId)
    await page.getByRole('button', { name: /^mark$/i }).click()
    await expect(page.locator('[data-scan-feedback="dup"]')).toContainText(new RegExp(`${name}`, 'i'))
    expect(await countOf(presentTab)).toBe(1)

    // Undo the mark, then record the same member by scanning instead
    await presentTab.click()
    const presentRow = await firstDataRow(page)
    await presentRow.getByRole('button', { name: new RegExp(`^remove from list: ${name}`, 'i') }).click()
    await expect.poll(() => countOf(presentTab)).toBe(0)
    await page.getByRole('textbox', { name: /scan a card/i }).fill(societyId)
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-scan-feedback="ok"]')).toContainText(new RegExp(`${name}`, 'i'))
    await expect.poll(() => countOf(presentTab)).toBe(1)
    await expect(page.getByText(/1 scanned here/i)).toBeVisible()

    // An unknown card is refused
    await page.getByRole('textbox', { name: /scan a card/i }).fill('NOSUCHID')
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-scan-feedback="err"]')).toBeVisible()

    // Switching the method warns that the marks are cleared, then flips the sides
    await page.getByLabel(/marking method/i).selectOption('absent')
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText(/will be cleared/i)
    await confirm.getByRole('button', { name: /change marking method/i }).click()
    await expect(page.getByText(/marking method changed/i)).toBeVisible()
    await expect.poll(() => countOf(presentTab)).toBe(roster)
    await expect.poll(() => countOf(absentTab)).toBe(0)
    await expect(page.getByText(/everyone not marked counts as present/i)).toBeVisible()

    // Delete — the event and its attendance rows go together
    await page.locator(`[data-event]`).filter({ hasText: title }).hover()
    await page.getByRole('button', { name: new RegExp(`delete event: ${title}`, 'i') }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText(/event deleted/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: title })).toHaveCount(0)
  })

  test('absentee method: marking someone lowers the present count', async ({ page }) => {
    const title = `E2E Absentees ${uniqueSuffix()}`
    await signIn(page)
    await page.goto('attendance')
    await page.getByRole('button', { name: /new event/i }).first().click()
    const dialog = page.getByRole('dialog', { name: /new event/i })
    await dialog.getByLabel(/^title/i).fill(title)
    await dialog.getByLabel(/event type/i).selectOption('funeral')
    await dialog.getByLabel(/marking method/i).selectOption('absent')
    await dialog.getByRole('button', { name: /create event/i }).click()
    await expect(page.getByRole('heading', { name: title })).toBeVisible()

    const presentTab = page.getByRole('tab', { name: /^present/i })
    const absentTab = page.getByRole('tab', { name: /^absent/i })
    const countOf = async (tab: typeof presentTab) => Number(((await tab.innerText()).match(/\((\d+)\)/) ?? [])[1] ?? -1)
    const roster = await countOf(presentTab)
    expect(roster).toBeGreaterThan(0)
    expect(await countOf(absentTab)).toBe(0)

    // Everyone counts as present until someone is marked absent
    const row = await firstDataRow(page)
    const name = (await row.locator('td').nth(1).innerText()).trim()
    await row.getByRole('button', { name: new RegExp(`^mark absent: ${name}`, 'i') }).click()
    await expect.poll(() => countOf(presentTab)).toBe(roster - 1)
    await expect.poll(() => countOf(absentTab)).toBe(1)

    // The events list counts presence the same way whichever method is used
    await expect(page.locator('[data-event]').filter({ hasText: title })).toContainText(String(roster - 1))

    await page.locator('[data-event]').filter({ hasText: title }).hover()
    await page.getByRole('button', { name: new RegExp(`delete event: ${title}`, 'i') }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^delete$/i }).click()
    await expect(page.getByText(/event deleted/i)).toBeVisible()
  })
})
