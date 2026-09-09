import { defineConfig, devices } from '@playwright/test'

// Two lanes (requirements §9): local/PR against the Vite dev server (which
// proxies the testbed API), and `@testbed` against the deployed QA host.
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173/'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure', locale: 'en-GB' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.PW_CHANNEL || undefined } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 }
})
