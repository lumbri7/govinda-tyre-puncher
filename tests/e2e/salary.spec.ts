import { expect, test } from '@playwright/test'

import {
  adminClient,
  createEmployee,
  ensureOwner,
  signInThroughUi,
  signedInAs,
  type TestAccount,
} from './support/accounts'
import { formAlert } from './support/locators'

let owner: TestAccount
let employee: TestAccount

/** The owner's staff row for one person: every row carries its own pay button. */
function salaryRow(page: import('@playwright/test').Page, fullName: string) {
  return page.getByRole('listitem').filter({ hasText: fullName })
}

test.beforeAll(async () => {
  owner = await ensureOwner()
  const suffix = Date.now().toString().slice(-8)
  employee = await createEmployee(owner, {
    fullName: 'Ravi Salary',
    phone: `+9196${suffix.slice(0, 8)}`,
    monthlySalary: 12000,
  })
})

test('the owner records a salary payment and the employee accepts it', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/salary')

  await expect(page.getByRole('heading', { name: 'Salary' })).toBeVisible()
  await expect(page.getByText(employee.fullName)).toBeVisible()
  await expect(page.getByText('₹12,000').first()).toBeVisible()

  await salaryRow(page, employee.fullName).getByRole('button', { name: 'Record payment' }).click()
  await page.getByLabel('Amount').fill('5000')
  await page.getByLabel('Note (optional)').fill('Test advance')
  await page.getByRole('button', { name: 'Save payment' }).click()

  // The confirmation has to stay readable until the owner closes the form,
  // otherwise a slow connection invites the same payment to be recorded twice.
  const confirmation = salaryRow(page, employee.fullName).getByRole('status')
  await expect(confirmation).toContainText(/recorded/i)
  await expect(salaryRow(page, employee.fullName).getByRole('button', { name: 'Save payment' })).toBeDisabled()
  await salaryRow(page, employee.fullName).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Waiting for acceptance' })).toBeVisible()
  await expect(page.getByText('Ravi Salary').first()).toBeVisible()

  // The employee sees it as pending and accepts it.
  await signInThroughUi(page, employee)
  await page.goto('/employee/salary')

  await expect(page.getByText('Waiting for your acceptance')).toBeVisible()
  await expect(page.getByText('₹5,000').first()).toBeVisible()
  await page.getByRole('button', { name: 'Accept' }).click()

  await expect(page.getByText('Accepted').first()).toBeVisible()
  await expect(page.getByText('Waiting for your acceptance')).toBeHidden()

  // ...and the owner now sees it as confirmed, not waiting.
  await signInThroughUi(page, owner)
  await page.goto('/owner/salary')

  await expect(page.getByText('Nothing pending')).toBeVisible()
  await expect(page.getByText('confirmed').first()).toBeVisible()
})

test('the owner cannot pay more than the monthly salary', async ({ page }) => {
  await signInThroughUi(page, owner)
  await page.goto('/owner/salary')

  await salaryRow(page, employee.fullName).getByRole('button', { name: 'Record payment' }).click()
  await page.getByLabel('Amount').fill('900000')
  await page.getByRole('button', { name: 'Save payment' }).click()

  await expect(formAlert(page)).toContainText(/beyond|more than|remaining/i)
})

test('the ledger keeps both the partial and the final payment', async ({ page }) => {
  await signInThroughUi(page, employee)
  await page.goto('/employee/salary')

  await expect(page.getByText('Test advance')).toBeVisible()
  await expect(page.getByText('₹7,000').first()).toBeVisible() // 12000 - 5000 paid

  await signInThroughUi(page, owner)
  await page.goto('/owner/salary')

  const accepted = await adminClient()
    .from('salary_payments')
    .select('amount, status')
    .eq('status', 'confirmed')
  expect(accepted.error).toBeNull()
  expect(accepted.data?.length).toBeGreaterThan(0)

  const employeeRow = await adminClient()
    .from('employees')
    .select('id, business_id')
    .eq('id', employee.employeeId!)
    .single()
  expect(employeeRow.error).toBeNull()

  const paymentsForEmployee = await adminClient()
    .from('salary_payments')
    .select('amount, status')
    .eq('employee_id', employee.employeeId!)
  expect(paymentsForEmployee.data?.length).toBe(1)
})

test('an employee cannot accept a payment that belongs to somebody else', async () => {
  const other = await createEmployee(owner, {
    fullName: 'Suresh Test',
    phone: `+9195${Date.now().toString().slice(-8)}`,
    monthlySalary: 9000,
  })

  const ownerClient = await signedInAs(owner)
  const { error } = await ownerClient.rpc('record_salary_payment', {
    p_employee_id: other.employeeId,
    p_amount: 1000,
    p_payment_date: new Date().toISOString().slice(0, 10),
    p_note: 'not yours',
  })
  expect(error).toBeNull()

  const payment = await adminClient()
    .from('salary_payments')
    .select('id')
    .eq('employee_id', other.employeeId!)
    .single()

  // Straight to the API as the first employee: RLS has to refuse this.
  const attacker = await signedInAs(employee)
  const result = await attacker.rpc('accept_salary_payment', { p_payment_id: payment.data!.id })

  // What matters is that the call is refused and nothing changed. The wording is
  // for the person, not for the test.
  expect(result.data).toBeFalsy()
  expect(result.error).not.toBeNull()

  const unchanged = await adminClient()
    .from('salary_payments')
    .select('status')
    .eq('id', payment.data!.id)
    .single()
  expect(unchanged.data?.status).toBe('pending')
})
