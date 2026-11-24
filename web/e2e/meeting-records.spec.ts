import { expect, test, type Page } from '@playwright/test'
import { CODE, signIn, uniqueSuffix } from './helpers'

// Meeting Records, office side (docs/MEETING-MINUTES-REQUIREMENTS.md §8.3):
// an administrator prepares minutes from the PC against the real API — pages
// go through sharp, the PDF is built by pdf-lib on the server, the recording
// is uploaded in chunks — and the draft is discarded at the end, so the run
// leaves nothing behind and never notifies members.
test.skip(!CODE, 'E2E_SAMITHI_CODE not set')

const SHOTS = process.env.E2E_SHOT_DIR

// A page photo drawn in the browser: distinct sizes so each page is its own
async function photo(page: Page, width: number, height: number, label: string): Promise<Buffer> {
  const dataUrl = await page.evaluate(([w, h, text]) => {
    const c = document.createElement('canvas')
    c.width = Number(w)
    c.height = Number(h)
    const g = c.getContext('2d')!
    g.fillStyle = '#fbfaf6'
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = '#334155'
    g.font = '48px serif'
    g.fillText(String(text), 60, 120)
    for (let y = 200; y < c.height - 60; y += 44) g.fillRect(60, y, c.width - 120 - ((y * 7) % 180), 4)
    return c.toDataURL('image/jpeg', 0.9)
  }, [width, height, label] as const)
  return Buffer.from(dataUrl.split(',')[1], 'base64')
}

// A run that failed half-way leaves its draft behind; clear those first
async function discardLeftovers(page: Page) {
  for (let i = 0; i < 5; i++) {
    await page.goto('meeting-records?status=drafts')
    await expect(page.getByRole('heading', { name: 'Meeting Records' })).toBeVisible()
    const leftover = page.getByRole('button', { name: /^E2E minutes / }).first()
    const empty = page.getByText('No drafts')
    await leftover.or(empty).first().waitFor()
    if (!(await leftover.isVisible())) return
    await leftover.click()
    await page.getByRole('button', { name: /discard draft/i }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /^discard$/i }).click()
    await expect(page.getByRole('heading', { name: 'Meeting Records' })).toBeVisible()
  }
}

test('an administrator prepares minutes from the PC, then discards the draft', async ({ page }) => {
  await signIn(page)
  await discardLeftovers(page)
  await page.goto('meeting-records')
  await expect(page.getByRole('heading', { name: 'Meeting Records' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-list.png`, fullPage: true })

  await page.getByRole('button', { name: /new meeting minutes/i }).click()
  const dialog = page.getByRole('dialog')
  const title = `E2E minutes ${uniqueSuffix()}`
  await dialog.getByLabel(/report title/i).fill(title)
  await dialog.getByLabel(/meeting date/i).fill(new Date(Date.now() - 86_400_000).toISOString().slice(0, 10))
  await dialog.getByRole('button', { name: /create draft/i }).click()
  await expect(page).toHaveURL(/edit=\d+/)
  await expect(page.getByRole('heading', { name: /new meeting minutes/i })).toBeVisible()

  const images = page.locator('input[type=file][accept^="image"]').first()
  await images.setInputFiles([
    { name: 'p1.jpg', mimeType: 'image/jpeg', buffer: await photo(page, 1200, 1600, 'Page one') },
    { name: 'p2.jpg', mimeType: 'image/jpeg', buffer: await photo(page, 1210, 1600, 'Page two') },
    { name: 'p3.jpg', mimeType: 'image/jpeg', buffer: await photo(page, 1600, 1200, 'Page three') }
  ])
  await expect(page.getByText('Pages (3)')).toBeVisible({ timeout: 30_000 })

  // Reorder with the keyboard-friendly buttons, then rotate the new first page
  await page.getByRole('button', { name: 'Move page 3 earlier' }).click()
  await expect(page.getByRole('button', { name: 'Move page 3 earlier' })).toBeEnabled()
  await page.getByRole('button', { name: 'Rotate page 1' }).click()
  await expect(page.getByRole('button', { name: 'Rotate page 1' })).toBeEnabled()

  // A small "m4a" (an ftyp header is all the server sniffs) goes up in chunks
  const audio = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(20_000, 7)])
  await page.locator('input[type=file][accept^="audio"]').setInputFiles({ name: 'reading.m4a', mimeType: 'audio/mp4', buffer: audio })
  await expect(page.getByText('Recording uploaded').first()).toBeVisible({ timeout: 30_000 })

  // The server builds the PDF from the pages in their current order
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: /preview pdf/i }).click()
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/)

  await expect(page.getByRole('button', { name: /^publish$/i })).toBeEnabled()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/w-draft.png`, fullPage: true })

  await page.getByRole('button', { name: /discard draft/i }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: /^discard$/i }).click()
  await expect(page.getByRole('heading', { name: 'Meeting Records' })).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)
})
