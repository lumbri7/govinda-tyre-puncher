import { expect, test } from '@playwright/test'

import { createEmployee, ensureOwner, signInThroughUi, type TestAccount } from './support/accounts'
import { formAlert } from './support/locators'

/** The wizard's continue button reads "Next" or "Skip" depending on the step. */
async function advance(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /^(Next|Skip)$/ }).click()
}

let owner: TestAccount
let employee: TestAccount

test.beforeAll(async () => {
  owner = await ensureOwner()
  const suffix = Date.now().toString().slice(-8)
  employee = await createEmployee(owner, {
    fullName: 'Ravi Billing',
    phone: `+9197${suffix.slice(0, 8)}`,
    monthlySalary: 12000,
  })
})

test('an employee creates a bill through the whole flow', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  // 1. vehicle
  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('pb 12 ab 1234')
  await advance(page)

  // 2. customer
  await page.getByLabel('Customer name').fill('Harjit Singh')
  await page.getByLabel('Mobile number (optional)').fill('9876543210')
  await advance(page)

  // 3. service charge
  await page.getByRole('button', { name: '₹100', exact: true }).click()
  await advance(page)

  // 4. services
  await page.getByRole('button', { name: /^Puncture Repair/ }).click()
  await advance(page)

  // 5. parts
  await page.getByRole('button', { name: /^Tube/ }).click()
  await advance(page)

  // 6. custom items: skipped on purpose
  await advance(page)

  // 7. review and save
  await expect(page.getByText('PB12AB1234')).toBeVisible()
  await expect(page.getByText('Service Charge', { exact: true })).toBeVisible()
  await expect(page.getByText('Harjit Singh').first()).toBeVisible()

  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)

  await expect(page.getByText('Bill saved.')).toBeVisible()
  await expect(page.getByText(/^GTP-\d{8}-\d{3}$/)).toBeVisible()
  await expect(page.getByText('+919876543210')).toBeVisible()
  await expect(page.getByText('₹700').first()).toBeVisible() // 100 charge + 150 service + 450 part
})

test('a bill cannot be saved without an item', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Car', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('DL01CD2345')
  await advance(page)
  await page.getByLabel('Customer name').fill('Sunita Devi')
  await advance(page)
  await advance(page)
  await advance(page)
  await advance(page)
  await advance(page)

  await expect(formAlert(page)).toHaveText('Add at least one item to the bill.')
  await expect(page.getByRole('button', { name: /Save bill/ })).toBeDisabled()
})

test('the owner sees the employee bill on the bills list and can open it', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('PB99ZZ4321')
  await advance(page)
  await page.getByLabel('Customer name').fill('Owner Visibility Check')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Puncture Repair/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)
  const billUrl = page.url()

  await signInThroughUi(page, owner)
  await page.goto('/owner/bills')

  // The whole card is the tap target on a phone.
  const card = page.getByRole('link', { name: /Owner Visibility Check/ })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(/\/owner\/bills\/[0-9a-f-]+/)
  expect(billUrl).not.toEqual(page.url())
  await expect(page.getByText('PB99ZZ4321')).toBeVisible()
})

test('an unrecognised vehicle is billed with a description of what came in', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Other', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('NOPLATE1')
  await advance(page)

  // Nothing else is known about the vehicle, so it has to be described.
  await expect(page.getByText('Describe the vehicle.')).toBeVisible()
  await page.getByLabel('What came in?').fill('Hand cart')
  await advance(page)

  await page.getByLabel('Customer name').fill('Kuldeep Singh')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Air Check/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)

  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)

  await expect(page.getByText('Hand cart')).toBeVisible()
})

test('the owner can find a bill by searching for the customer', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/bills')

  await page.getByPlaceholder('Bill number, customer, vehicle or staff').fill('Owner Visibility')
  await page.getByRole('button', { name: 'Search' }).click()
  await page.waitForURL(/q=Owner/)

  await expect(page.getByRole('link', { name: /Owner Visibility Check/ })).toBeVisible()
  await expect(page.getByText('Matching nothing')).toHaveCount(0)

  // Something that is not in the shop must come back empty rather than list
  // everything.
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.waitForURL((url) => !url.searchParams.has('q'))
})

test('a bill offers WhatsApp only when the customer number is known', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('WA1234567')
  await advance(page)
  await page.getByLabel('Customer name').fill('Gurpreet Kaur')
  await page.getByLabel('Mobile number (optional)').fill('9812345678')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Air Check/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)

  const whatsapp = page.getByRole('link', { name: 'WhatsApp' })
  const href = await whatsapp.getAttribute('href')
  expect(href).toContain('https://wa.me/919812345678?text=')
  expect(decodeURIComponent(href ?? '')).toContain('Gurpreet Kaur')

  // Without a number the button must not appear at all.
  await page.goto('/employee/bill/new')
  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('WA7654321')
  await advance(page)
  await page.getByLabel('Customer name').fill('No Number Customer')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Air Check/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)

  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveCount(0)
})

test('the print route shows the bill with no app navigation', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('PR7654321')
  await advance(page)
  await page.getByLabel('Customer name').fill('Print Check')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Puncture Repair/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)
  const billPath = new URL(page.url()).pathname

  // The action buttons live outside the document and point at the print route.
  await expect(page.getByRole('link', { name: 'Print' })).toHaveAttribute(
    'href',
    `/bill${billPath.replace('/employee/bills', '')}/print`,
  )

  // window.print() is a no-op in headless Chromium, so go straight to the route.
  await page.goto(`/bill${billPath.replace('/employee/bills', '')}/print`)

  await expect(page.getByText('Service Bill')).toBeVisible()
  await expect(page.getByText('Print Check')).toBeVisible()
  await expect(page.getByText('₹150').first()).toBeVisible()

  // Nothing from the app shell may reach the paper.
  await expect(page.locator('nav')).toHaveCount(0)
  await expect(page.getByRole('banner')).toHaveCount(0)
  // Scoped to the document: the dev server also injects its own overlay button.
  await expect(page.locator('main').getByRole('button')).toHaveCount(0)
  await expect(page.locator('main').getByRole('link')).toHaveCount(0)
})

test("an employee cannot print another employee's bill", async ({ page }) => {
  const other = await createEmployee(owner, {
    fullName: 'Bill Boundary',
    phone: `+9186${Date.now().toString().slice(-8)}`,
    monthlySalary: 9000,
  })

  await signInThroughUi(page, employee)
  await page.goto('/employee/bill/new')

  await page.getByRole('button', { name: 'Bike', exact: true }).click()
  await page.getByLabel('Vehicle number').fill('PR1111111')
  await advance(page)
  await page.getByLabel('Customer name').fill('Private Bill')
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /^Puncture Repair/ }).click()
  await advance(page)
  await advance(page)
  await advance(page)
  await page.getByRole('button', { name: /Save bill/ }).click()
  await page.waitForURL(/\/employee\/bills\/[0-9a-f-]+/)
  const billId = new URL(page.url()).pathname.split('/').pop()

  // The colleague must not be able to open it on screen or on the print route.
  await signInThroughUi(page, other)
  await page.goto(`/employee/bills/${billId}`)
  await expect(page.getByText('not yours to view')).toBeVisible()

  // RLS hides the bill, so the print route finds nothing to print. The status
  // code is not asserted: Next streams this page and reports 200 for the
  // not-found body, which is a framework detail, not a security control.
  await page.goto(`/bill/${billId}/print`)
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.getByText('Private Bill')).toHaveCount(0)
})
