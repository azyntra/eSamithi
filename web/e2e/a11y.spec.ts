import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { CODE, signIn } from './helpers'

// Every route is checked in both languages and both themes. WCAG 2.1 A/AA is
// the bar (requirements §9); a violation here is a real defect, not a warning.
const ROUTES = ['dashboard', 'members', 'incomes', 'expenses', 'loans', 'wallet', 'attendance', 'messages', 'reports', 'settings']

// Motion keeps opacity fades even under prefers-reduced-motion, and a half
// faded label really does fail contrast — so wait for the page to settle
// before judging it.
async function settle(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
  await page.waitForTimeout(250)
}

async function scan(page: Page) {
  await settle(page)
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return results.violations.map((v) => `${v.id} (${v.nodes.length}) — ${v.help}`)
}

test.describe('accessibility', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')
  // Entrance animations run opacity from 0, which axe reads as failing
  // contrast mid-flight. The app honours prefers-reduced-motion, so asking for
  // it makes every scan deterministic — and checks that path too.
  test.use({ reducedMotion: 'reduce' })

  test('the sign-in flow has no violations', async ({ page }) => {
    await page.goto('login')
    await expect(page.getByLabel(/samithi code/i)).toBeVisible()
    expect(await scan(page)).toEqual([])
  })

  test('every route is clean in English', async ({ page }) => {
    await signIn(page)
    for (const route of ROUTES) {
      await page.goto(route)
      await expect(page.getByRole('heading').first()).toBeVisible()
      expect(await scan(page), `route: ${route}`).toEqual([])
    }
  })

  test('the shell is clean in Sinhala and in dark mode', async ({ page }) => {
    await signIn(page)
    await page.getByRole('button', { name: /dark mode/i }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.getByRole('button', { name: 'සිං' }).first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'si')
    for (const route of ['dashboard', 'members', 'loans', 'attendance', 'settings']) {
      await page.goto(route)
      await expect(page.getByRole('heading').first()).toBeVisible()
      expect(await scan(page), `route: ${route} (si/dark)`).toEqual([])
    }
  })

  test('the command palette and a form sheet are clean', async ({ page }) => {
    await signIn(page)
    await page.keyboard.press('ControlOrMeta+k')
    await expect(page.getByPlaceholder(/search members, pages and actions/i)).toBeVisible()
    expect(await scan(page), 'command palette').toEqual([])
    await page.keyboard.press('Escape')

    await page.goto('members?create=1')
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(await scan(page), 'member form').toEqual([])
  })
})
