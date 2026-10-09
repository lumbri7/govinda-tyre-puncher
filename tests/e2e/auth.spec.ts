import { expect, test } from '@playwright/test'

import {
  adminClient,
  createEmployee,
  ensureOwner,
  recordEmployeeCreatedInApp,
  signInThroughUi,
  type TestAccount,
} from './support/accounts'
import { formAlert } from './support/locators'

let owner: TestAccount
let employee: TestAccount
let resettable: TestAccount

test.beforeAll(async () => {
  owner = await ensureOwner()
  const suffix = Date.now().toString().slice(-8)
  employee = await createEmployee(owner, {
    fullName: 'Ravi Auth',
    phone: `+9198${suffix.slice(0, 8)}`,
    monthlySalary: 12000,
  })
  resettable = await createEmployee(owner, {
    fullName: 'Suresh Reset',
    phone: `+9189${suffix.slice(0, 8)}`,
    monthlySalary: 11000,
  })
})

test('the owner signs in with email and reaches the dashboard', async ({ page }) => {
  await signInThroughUi(page, owner)

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByText('Sales today')).toBeVisible()
})

test('an employee signs in with their mobile number and sees the employee home', async ({
  page,
}) => {
  await signInThroughUi(page, employee)

  await expect(page.getByRole('heading', { name: /^Hello,/ })).toBeVisible()
  await expect(page.getByRole('link', { name: '+ New Bill' })).toBeVisible()
})

test('a wrong password is rejected without revealing which field was wrong', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Shop owner' }).click()
  await page.getByLabel('Email').fill(owner.email!)
  await page.getByLabel('Password', { exact: true }).fill('definitely-wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(formAlert(page)).toHaveText(/Email or password is incorrect/)
  await expect(page).toHaveURL(/\/login/)
})

test('signing out ends the session', async ({ page }) => {
  await signInThroughUi(page, employee)

  await page.goto('/employee/me')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login/)

  await page.goto('/employee/salary')
  await expect(page).toHaveURL(/\/login/)
})

test('resetting a password ends every session that employee had', async ({ page, browser }) => {
  await signInThroughUi(page, resettable)
  // The home screen greets with the first name only.
  const firstName = resettable.fullName.split(' ')[0]
  await expect(page.getByRole('heading', { name: `Hello, ${firstName}` })).toBeVisible()

  // The owner sets a new password on a different device.
  const newPassword = 'counter-desk-91'
  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await signInThroughUi(ownerPage, owner)
  await ownerPage.goto(`/owner/employees/${resettable.employeeId}`)
  await ownerPage.getByLabel('New password', { exact: true }).fill(newPassword)
  await ownerPage.getByLabel('Confirm new password', { exact: true }).fill(newPassword)
  await ownerPage.getByRole('button', { name: 'Save new password' }).click()

  const confirmation = ownerPage.getByRole('status')
  await expect(confirmation).toContainText(/Password updated/i)
  await expect(confirmation).toContainText(/signed out of every device/i)

  // The password is never echoed back to the browser.
  expect(await confirmation.textContent()).not.toContain(newPassword)
  await ownerContext.close()

  // The first device is signed out, not just asked for the new password.
  await page.goto('/employee/salary')
  await expect(page).toHaveURL(/\/login/)

  await page.getByRole('tab', { name: 'Employee' }).click()
  await page.getByLabel('Mobile number').fill((resettable.phone ?? '').replace('+91', ''))
  await page.getByLabel('Password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/employee/)
})

test('a mismatched password confirmation is refused', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/employees')

  await page.getByRole('link', { name: '+ Add' }).click()
  const suffix = Date.now().toString().slice(-8)
  await page.getByLabel('Full name').fill('Mismatch Test')
  await page.getByLabel('Mobile number').fill(`9876${suffix.slice(0, 6)}`.slice(0, 10))
  await page.getByLabel('Monthly salary').fill('9000')
  await page.getByLabel('Login password', { exact: true }).fill('desk-pass-42')
  await page.getByLabel('Confirm password', { exact: true }).fill('desk-pass-43')
  await page.getByRole('button', { name: 'Add employee' }).click()

  await expect(page.getByText('Both passwords must match.')).toBeVisible()
})

test('an employee the owner adds can sign in with that number and password', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/employees')

  await page.getByRole('link', { name: '+ Add' }).click()
  const suffix = Date.now().toString().slice(-8)
  const number = `9766${suffix.slice(0, 6)}`
  const password = 'counter-desk-42'
  await page.getByLabel('Full name').fill('Deepak Test')
  await page.getByLabel('Mobile number').fill(number)
  await page.getByLabel('Monthly salary').fill('9500')
  await page.getByLabel('Login password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Add employee' }).click()

  await expect(page).toHaveURL(/\/owner\/employees/)
  await expect(page.getByRole('status')).toContainText('Deepak Test added')
  await expect(page.getByRole('link', { name: /Deepak Test/ })).toBeVisible()

  // This employee was made through the screen, so the teardown has to be told
  // about it or it stays in the shop's staff list.
  await recordEmployeeCreatedInApp('Deepak Test')

  // Sign out is only on the settings screen, so swap accounts the way a test
  // does elsewhere: drop the browser cookies and land on the sign in form for
  // the employee who was just added.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Employee' }).click()
  await page.getByLabel('Mobile number').fill(number)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page).toHaveURL(/\/employee/)
  await expect(page.getByRole('heading', { name: /Hello,/ })).toBeVisible()
})

test('a number nobody has is refused exactly like a wrong password', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Employee' }).click()

  await page.getByLabel('Mobile number').fill('9000000000')
  await page.getByLabel('Password', { exact: true }).fill('employee-pass-123')
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(formAlert(page)).toHaveText('Mobile number or password is incorrect.')
  await expect(page).toHaveURL(/\/login/)
})

test('an employee cannot take a colleague’s mobile number', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto(`/owner/employees/${employee.employeeId}`)

  // Saving a number that already belongs to someone else must be refused by the
  // database, and must not leave the first employee's login broken.
  await page.getByLabel('Mobile number').fill((resettable.phone ?? '').replace('+91', ''))
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect(formAlert(page)).toContainText(/already/i)

  // The owner session must not shadow the login screen, and the employee's own
  // login is what has to still work after the database refused the edit.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Employee' }).click()
  await page.getByLabel('Mobile number').fill((employee.phone ?? '').replace('+91', ''))
  await page.getByLabel('Password', { exact: true }).fill(employee.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/employee/)
})

test('the address the login is stored under is never shown to anyone', async ({ page }) => {
  const internalAddress = await adminClient()
    .auth.admin.getUserById(employee.userId)
    .then(({ data }) => data.user?.email ?? '')

  expect(internalAddress).toContain('@auth.govindatyrepuncture.internal')

  await signInThroughUi(page, employee)
  await page.goto('/employee/me')
  expect(await page.content()).not.toContain('@auth.govindatyrepuncture.internal')
  expect(await page.content()).not.toContain(internalAddress)

  await page.goto('/owner/employees')
  await signInThroughUi(page, owner)
  await page.goto('/owner/employees')
  expect(await page.content()).not.toContain('@auth.govindatyrepuncture.internal')
})
