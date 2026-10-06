import { expect, test } from '@playwright/test'

import {
  adminClient,
  anonClient,
  createEmployee,
  ensureOwner,
  signInThroughUi,
  signedInAs,
  type TestAccount,
} from './support/accounts'
import { formAlert } from './support/locators'

/**
 * These are the checks that matter most: the employee screens must never leak
 * another person's money, bills or messages, even with a hand crafted URL or a
 * direct call to the API.
 */

let owner: TestAccount
let first: TestAccount
let second: TestAccount

test.beforeAll(async () => {
  owner = await ensureOwner()
  const suffix = Date.now().toString().slice(-8)
  first = await createEmployee(owner, {
    fullName: 'Ravi Isolation',
    phone: `+9194${suffix.slice(0, 8)}`,
    monthlySalary: 12000,
  })
  second = await createEmployee(owner, {
    fullName: 'Suresh Isolation',
    phone: `+9193${suffix.slice(0, 8)}`,
    monthlySalary: 11000,
  })

  // A bill for each employee, plus a notification meant for the second one only.
  for (const [account, customer] of [
    [first, 'First Employee Customer'],
    [second, 'Second Employee Customer'],
  ] as const) {
    const client = await signedInAs(account)
    const { error } = await client.rpc('create_bill', {
      p_customer_name: customer,
      p_vehicle_type: 'bike',
      p_vehicle_number: 'PB10AB1111',
      p_items: [
        { item_type: 'service', name: 'Puncture Repair', quantity: '1', unit_price: '150' },
      ],
      p_customer_phone: null,
    })
    expect(error).toBeNull()
  }

  const shop = await adminClient()
    .from('employees')
    .select('business_id')
    .eq('id', first.employeeId!)
    .single()
  expect(shop.error).toBeNull()

  await adminClient().from('notifications').insert({
    business_id: shop.data!.business_id,
    user_id: second.userId,
    type: 'employee_joined',
    title: 'Private message for Suresh',
    message: 'Only Suresh may read this.',
  })
})

test('an employee cannot open the owner screens', async ({ page }) => {
  await signInThroughUi(page, first)

  for (const path of [
    '/owner',
    '/owner/bills',
    '/owner/salary',
    '/owner/employees',
    '/owner/reports',
    '/owner/settings',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/employee/)
  }
})

test('the owner cannot open the employee screens', async ({ page }) => {
  await signInThroughUi(page, owner)

  for (const path of [
    '/employee/bill/new',
    '/employee/salary',
    '/employee/bills',
    '/employee/me',
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/owner/)
  }
})

test("an employee cannot open another employee's bill, even with the exact id", async ({
  page,
}) => {
  await signInThroughUi(page, second)

  const otherBill = await adminClient()
    .from('bills')
    .select('id')
    .eq('created_by', first.userId)
    .single()

  await page.goto(`/employee/bills/${otherBill.data!.id}`)
  await expect(page.getByText(/does not exist or is not yours/i)).toBeVisible()
  await expect(page.getByText('First Employee Customer')).toBeHidden()

  await page.goto(`/owner/bills/${otherBill.data!.id}`)
  await expect(page).toHaveURL(/\/employee/)
})

test('the API refuses to hand over another employee’s bills, salaries and alerts', async () => {
  const client = await signedInAs(first)

  const bills = await client.from('bills').select('id, customer_name')
  expect(bills.error).toBeNull()
  expect(bills.data?.every((bill) => bill.customer_name !== 'Second Employee Customer')).toBe(true)

  const payments = await client.from('salary_payments').select('employee_id, amount')
  expect(payments.error).toBeNull()
  expect(payments.data?.every((row) => row.employee_id === first.employeeId)).toBe(true)

  const alerts = await client.from('notifications').select('title')
  expect(alerts.error).toBeNull()
  expect(alerts.data?.some((row) => row.title === 'Private message for Suresh')).toBe(false)

  // And nobody can borrow somebody else's identity.
  const reports = await client.rpc('sales_summary', {
    p_from: '2000-01-01T00:00:00Z',
    p_to: '2100-01-01T00:00:00Z',
  })
  expect(reports.data ?? []).toEqual([])
  expect(reports.error).not.toBeNull()

  const employees = await client.from('employees').select('id')
  expect(employees.data?.map((row) => row.id)).toEqual([first.employeeId])
})

test('a signed out browser gets no data at all', async () => {
  const anonymous = anonClient()

  const bills = await anonymous.from('bills').select('id')
  expect(bills.data ?? []).toEqual([])

  const reports = await anonymous.rpc('sales_summary', {
    p_from: '2000-01-01T00:00:00Z',
    p_to: '2100-01-01T00:00:00Z',
  })
  expect(reports.error?.message).toMatch(/permission|not allowed|denied/i)
})

test('a browser cannot turn a mobile number into a login identity', async () => {
  // The employee sign in resolves number -> Auth user on the server with the
  // elevated key. Everything a browser holds must be refused here, or anyone
  // could enumerate who works in the shop and what their login is called.
  const anonymous = anonClient()
  const { data: employees } = await adminClient().from('employees').select('user_id').limit(1)
  const [employee] = employees ?? []
  expect(employee).toBeDefined()

  const { data: profile } = await adminClient()
    .from('profiles')
    .select('phone')
    .eq('id', employee.user_id)
    .single()
  expect(profile).not.toBeNull()

  const lookup = await anonymous.rpc('employee_auth_user_id', { p_phone: profile!.phone })
  expect(lookup.data).toBeFalsy()
  expect(lookup.error?.message).toMatch(/permission|not allowed|denied/i)

  // And the phone is not readable from the tables either. An empty list or a
  // refused request both answer the question; a row full of numbers does not.
  const profiles = await anonymous.from('profiles').select('phone')
  expect(profiles.data ?? []).toEqual([])

  // Only the elevated key can do the lookup, which is what the sign in action
  // does server side.
  const privileged = await adminClient().rpc('employee_auth_user_id', { p_phone: profile!.phone })
  expect(privileged.error).toBeNull()
  expect(privileged.data).toBe(employee.user_id)
})

test('a disabled employee is locked out, even with a session that still works', async ({
  page,
}) => {
  const ownerClient = await signedInAs(owner)
  const { error } = await ownerClient.rpc('set_employee_active', {
    p_employee_id: second.employeeId,
    p_is_active: false,
  })
  expect(error).toBeNull()

  // The Auth login still exists, so prove the database itself is the wall.
  const stale = await signedInAs(second)

  const bills = await stale.from('bills').select('id')
  expect(bills.data ?? []).toEqual([])

  const newBill = await stale.rpc('create_bill', {
    p_customer_name: 'Should never exist',
    p_vehicle_type: 'car',
    p_vehicle_number: 'PB00ZZ0000',
    p_items: [{ item_type: 'service', name: 'Puncture Repair', quantity: '1', unit_price: '150' }],
    p_customer_phone: null,
  })
  expect(newBill.data).toBeFalsy()
  expect(newBill.error?.message).toMatch(/permission|not allowed|denied|active/i)

  // Signing in again is refused, and refused the same way an unknown number is:
  // the lookup ignores disabled accounts, so this form must not tell the
  // employee (or anyone watching over their shoulder) that the number is real
  // but switched off.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Employee' }).click()
  await page.getByLabel('Mobile number').fill((second.phone ?? '').replace('+91', ''))
  await page.getByLabel('Password', { exact: true }).fill(second.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(formAlert(page)).toHaveText('Mobile number or password is incorrect.')
  await expect(page).toHaveURL(/\/login/)
})

test('a new employee only sees their own salary, never a colleague’s', async ({ page }) => {
  await signInThroughUi(page, first)
  await page.goto('/employee/salary')

  await expect(page.getByText('₹12,000.00').first()).toBeVisible()
  await expect(page.getByText('₹11,000.00')).toBeHidden()
  await expect(page.getByRole('link', { name: /Suresh Isolation/ })).toBeHidden()
})

test('the owner keeps full visibility', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/employees')

  await expect(page.getByRole('link', { name: /Ravi Isolation/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Suresh Isolation/ })).toBeVisible()
  // "1 disabled" in the summary carries the same word, so ask for the badge.
  await expect(
    page.getByRole('link', { name: /Suresh Isolation/ }).getByText('Disabled', { exact: true }),
  ).toBeVisible()
})
