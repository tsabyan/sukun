import { defineConfig, devices } from '@playwright/test'

/**
 * E2E covers the one thing unit tests cannot reach: the timer running in a
 * real browser, with a real Web Worker, across a real backgrounding.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Dev, not a production build: the service worker would otherwise serve a
    // cached shell between specs and make failures very hard to read.
    command: 'npm run dev -- --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
