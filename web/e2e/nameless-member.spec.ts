import { expect, test, type APIRequestContext } from '@playwright/test'
import { CODE, PASS, signIn, uniqueSuffix, USER } from './helpers'

// Production has members entered from paper with nothing but a society ID —
// name, NIC and phone all NULL — and the API accepts exactly that (it nulls
// blanks and validates nothing). The first release crashed the whole
// application on the first keystroke in any member picker because of one such
// row. This spec keeps one on the testbed for the length of the test.

const base = () => (process.env.E2E_BASE_URL || 'http://localhost:5173/').replace(/\/$/, '')

async function staffToken(request: APIRequestContext): Promise<{ token: string; slug: string }> {
  const resolved = await (await request.get(`${base()}/directory/v1/resolve/${CODE}`)).json()
  const login = await request.post(`${base()}/api/v1/auth/login`, {
    headers: { 'X-Samithi': resolved.slug },
    data: { username: USER, password: PASS }
  })
  expect(login.ok()).toBeTruthy()
  return { token: (await login.json()).token, slug: resolved.slug }
}

test.describe('a member with no name on record', () => {
  test.skip(!CODE, 'set E2E_SAMITHI_CODE to run against a real API')

  let memberId = 0
  let societyId = ''
  let auth: { token: string; slug: string }

  test.beforeAll(async ({ request }) => {
    auth = await staffToken(request)
    societyId = `NN${uniqueSuffix().slice(-5)}`
    const res = await request.post(`${base()}/api/v1/members`, {
      headers: { Authorization: `Bearer ${auth.token}`, 'X-Samithi': auth.slug },
      data: { society_id: societyId, dependents: [] }
    })
    expect(res.ok()).toBeTruthy()
    memberId = (await res.json()).id
  })

  test.afterAll(async ({ request }) => {
    if (memberId) await request.delete(`${base()}/api/v1/members/${memberId}`, { headers: { Authorization: `Bearer ${auth.token}`, 'X-Samithi': auth.slug } })
  })

  test('typing in the loan member picker does not crash, and the member is found by ID', async ({ page }) => {
    await signIn(page)
    await page.goto('loans')
    await page.getByRole('button', { name: /issue new loan/i }).first().click()
    const sheet = page.getByRole('dialog')
    await expect(sheet.getByRole('heading', { name: /issue new loan/i })).toBeVisible()

    await sheet.getByRole('combobox', { name: /applicant member/i }).click()
    const listbox = page.getByRole('listbox').last()
    await expect(listbox).toBeVisible()
    const search = page.getByPlaceholder(/search by name, member id or nic/i)
    await search.fill('a')
    await expect(listbox.getByRole('option').first()).toBeVisible()
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0)

    await search.fill(societyId)
    const option = listbox.getByRole('option', { name: new RegExp(societyId) })
    await expect(option).toBeVisible()
    await expect(option).toContainText(/unnamed member/i)
    await option.click()
    await expect(sheet.getByRole('combobox', { name: /applicant member/i })).toContainText(/unnamed member/i)
  })

  test('the member registry and the command palette show the record without breaking', async ({ page }) => {
    await signIn(page)
    await page.goto(`members/${memberId}`)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('—')
    await page.keyboard.press('Meta+k')
    await page.getByPlaceholder(/search/i).last().fill(societyId)
    await expect(page.getByRole('option', { name: new RegExp(societyId) })).toContainText(/unnamed member/i)
  })
})
