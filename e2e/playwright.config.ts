import { defineConfig, devices } from '@playwright/test'

const CI = Boolean(process.env.CI)

/**
 * The stack (back, front, Redis, Mailpit) is started outside Playwright, with docker compose
 * (`npm run stack:up`). Every test creates its own users, so the suite needs no reset between runs.
 *
 * One worker: concurrent sign-ups currently fail with SQLITE_BUSY (a deferred transaction that
 * reads before writing cannot wait for the lock), which the API reports as 409.
 */
export default defineConfig({
  testDir: './tests',
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    baseURL: `http://localhost:${process.env.E2E_FRONT_PORT ?? 5173}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
