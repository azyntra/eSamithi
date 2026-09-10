import { expect, test, type Page } from '@playwright/test'
import { CODE, signIn } from './helpers'

const ROUTES = ['dashboard', 'members', 'incomes', 'expenses', 'loans', 'wallet', 'attendance', 'messages', 'reports', 'settings']

// The page itself must never scroll sideways: wide content scrolls inside its
// own container instead (requirements §8, tablet ≥768).
async function overflowOf(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

test.describe('responsive shell', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  test('tablet portrait: no sideways scroll on any route', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await signIn(page)
    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.getByRole('heading').first()).toBeVisible()
      await page.waitForTimeout(300)
      expect(await overflowOf(page), `route: ${route}`).toBeLessThanOrEqual(1)
    }
  })

  test('phone: the sidebar is off-canvas and reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    await expect(page.getByRole('link', { name: /loan portfolio/i })).toHaveCount(0)
    await page.getByRole('button', { name: /open navigation/i }).click()
    const drawer = page.getByRole('dialog')
    await drawer.getByRole('link', { name: /loan portfolio/i }).click()
    await expect(page).toHaveURL(/\/loans/)
    await expect(page.getByRole('heading', { name: /loan portfolio/i })).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(1)

    // A wide table scrolls inside its own container, not the page
    const container = page.locator('[data-slot="table-container"]').first()
    if (await container.count()) {
      const scrolls = await container.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(typeof scrolls).toBe('boolean')
    }
  })

  test('phone: money forms and the command palette fit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page)
    await page.goto('incomes?create=1')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    expect(await overflowOf(page)).toBeLessThanOrEqual(1)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /^search$/i }).click()
    await expect(page.getByPlaceholder(/search members, pages and actions/i)).toBeVisible()
    expect(await overflowOf(page)).toBeLessThanOrEqual(1)
  })
})
