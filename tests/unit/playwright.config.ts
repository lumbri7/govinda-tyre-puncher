import { defineConfig } from '@playwright/test'

/**
 * Focused unit tests that run entirely in Node: no browsers, no dev server, no
 * database. Playwright's own TypeScript transform is the loader, so a plain
 * `src/lib/*.ts` module can be imported directly without a separate test runner
 * or build step.
 */
export default defineConfig({
  testDir: './',
  testMatch: /\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 4,
  reporter: [['list']],
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
})