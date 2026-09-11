import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Operator support mode (FR-15), driven in a real browser against a stubbed
// tenant API. Minting a real impersonation token needs the platform's signing
// secret; what matters here is what the app does with one it is handed, and
// the one thing a jsdom test cannot prove — that the fragment is consumed
// before the router ever sees the URL.
const TOKEN = 'header.eyJhY3QiOiJzYTozIn0.signature'

const pack = (payload: unknown): string => encodeURIComponent(Buffer.from(JSON.stringify(payload), 'utf8').toString('base64'))

const STATS = {
  totalMembers: 0,
  totalLiquid: 0,
  totalFDs: 0,
  totalLoansOwed: 0,
  chartData: { income: [], expenses: [] },
  recentActivity: []
}

async function stubApi(page: Page, support: unknown): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/auth/me')) {
      return route.fulfill({
        json: {
          id: 0,
          username: 'eSamithi Support (ops@esamithi.lk)',
          full_name: 'eSamithi Support',
          role: 'admin',
          must_change_password: false,
          samithi: { slug: 'demo01', name: 'Demo Samithiya' },
          session: null,
          support
        }
      })
    }
    if (url.includes('/dashboard/stats')) return route.fulfill({ json: STATS })
    if (url.includes('/settings')) return route.fulfill({ json: {} })
    return route.fulfill({ json: [] })
  })
}

const live = {
  actor: 'sa:3',
  sid: 'e2e-sid',
  expires_at: new Date(Date.now() + 59 * 60_000).toISOString()
}

test.describe('support mode', () => {
  test('a handoff signs the operator in, and the token never stays in the URL', async ({ page }) => {
    await stubApi(page, live)
    await page.goto(`support#s=${pack({ token: TOKEN, slug: 'demo01', console: 'https://console.esamithi.com' })}`)

    await expect(page).toHaveURL(/\/dashboard$/)
    expect(page.url()).not.toContain('#s=')
    expect(page.url()).not.toContain(TOKEN)

    const banner = page.getByRole('region', { name: /support session/i })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('Demo Samithiya')
    await expect(banner).toContainText('ops@esamithi.lk')
    await expect(banner).toContainText(/ends in \d+:\d\d/)

    // The office sidebar is still there and still usable — support mode is the
    // same application, not a cut-down one.
    await expect(page.getByRole('navigation')).toBeVisible()
  })

  test('exit returns to the console with the sid it has to revoke', async ({ page }) => {
    await stubApi(page, live)
    await page.goto(`support#s=${pack({ token: TOKEN, slug: 'demo01', console: 'https://console.esamithi.com' })}`)
    await expect(page.getByRole('region', { name: /support session/i })).toBeVisible()

    // Stand in for the console so no request actually leaves for the live one
    await page.route('https://console.esamithi.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>console</h1>' }))
    await page.getByRole('button', { name: /exit samithi/i }).click()

    // The sid rides in the fragment — never sent to a server, read by the
    // console's own hash router — so it is the page URL that has to carry it.
    await expect(page).toHaveURL('https://console.esamithi.com/admin/#/?exit=e2e-sid')
  })

  test('a payload the API will not vouch for gets nowhere', async ({ page }) => {
    await stubApi(page, null)
    await page.goto(`support#s=${pack({ token: 'forged', slug: 'demo01', console: 'https://evil.example' })}`)

    await expect(page.getByText(/no active support session/i)).toBeVisible()
    await expect(page.getByRole('region', { name: /support session/i })).toHaveCount(0)
    expect(page.url()).not.toContain('#s=')
    // and it is not kept for a second try on the next reload
    expect(await page.evaluate(() => sessionStorage.getItem('esamithi.web.support'))).toBeNull()
  })

  // The banner is red-on-white by design rather than themed, so it is the one
  // surface that never gets checked by the palette work — check it here.
  test('the banner passes axe in both themes', async ({ page }) => {
    await stubApi(page, live)
    await page.goto(`support#s=${pack({ token: TOKEN, slug: 'demo01', console: 'https://console.esamithi.com' })}`)
    await expect(page.getByRole('region', { name: /support session/i })).toBeVisible()
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate((t) => {
        document.documentElement.dataset.theme = t
      }, theme)
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))))
      const results = await new AxeBuilder({ page }).include('[role="region"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${theme}: ${v.id} — ${v.help}`)).toEqual([])
    }
  })

  test('landing on /support with nothing says so instead of half-opening', async ({ page }) => {
    await stubApi(page, null)
    await page.goto('support')
    await expect(page.getByText(/no active support session/i)).toBeVisible()
  })
})
