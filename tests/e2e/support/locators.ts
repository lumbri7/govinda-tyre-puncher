import type { Page } from '@playwright/test'

/**
 * Next.js renders its own `role="alert"` route announcer in the body, so a bare
 * `getByRole('alert')` matches two elements and fails in strict mode. Every
 * message this app shows is rendered by `FormMessage`, which always sits inside
 * a form, so that is the container the specs mean.
 */
export function formAlert(page: Page) {
  return page.locator('main form').getByRole('alert')
}
