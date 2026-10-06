import { readFileSync } from 'node:fs'

import { defineConfig, devices } from '@playwright/test'

// The test project details live in .env.test.local (git ignored, same shape as
// .env.example) so the shell running `npm test:e2e` does not need exporting.
for (const file of ['.env.test.local', '.env.local']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
      if (match && !match[2].startsWith('#')) {
        process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // no file, nothing to load
  }
}

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/**
 * End to end tests run against a real Supabase project: the whole point of the
 * app is that row level security works, and that can only be proven against the
 * real Postgres instance (and real Auth).
 *
 * Copy .env.example to .env.test.local and fill it in before running these.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  globalTeardown: './tests/e2e/support/teardown.ts',
  projects: [
    {
      // The shop runs on phones, so this is the primary target.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})