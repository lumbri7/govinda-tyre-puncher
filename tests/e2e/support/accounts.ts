import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { newInternalEmployeeEmail } from '@/lib/employee-identity'
import { recordFixture } from './fixture-manifest'

/**
 * Test account provisioning.
 *
 * These tests talk to a real Supabase project, so the owner and the employees
 * are created with the elevated key exactly like the app would, and every
 * assertion then runs as a normal signed-in user (publishable key) so row level
 * security is genuinely under test.
 *
 * Employee logins are internal addresses, never the phone number: the tests use
 * the same helper the app does, so a change there cannot pass here and fail in
 * the shop.
 *
 * A project with no shop yet is the easy case: the tests create the owner and
 * the shop through `bootstrap_owner`, exactly like a real first run. A project
 * that already has a shop cannot do that, so set E2E_FIXTURE_MODE=service_role
 * and the fixtures are written straight to the tables instead. Everything the
 * run creates is listed in tests/e2e/.fixtures.json and removed again by the
 * global teardown, so a shared project is left exactly as it was found.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

/** Writes fixtures straight to the tables, for a project that already has a shop. */
const fixtureMode = process.env.E2E_FIXTURE_MODE === 'service_role'

export type Role = 'owner' | 'employee'

export type TestAccount = {
  role: Role
  email?: string
  phone?: string
  password: string
  fullName: string
  userId: string
  employeeId?: string
}

let admin: SupabaseClient | undefined

export function adminClient(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.example to .env.test.local.',
    )
  }
  admin ??= createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return admin
}

export function anonClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.')
  }
  return createClient(url, anonKey, { auth: { persistSession: false } })
}

/**
 * Creating a login goes over the network, and this machine occasionally drops
 * the connection (`fetch failed`) rather than getting an answer. A dropped
 * connection is not the same as a rejected request, so the retry first looks
 * the user up by email: if the very first attempt actually reached Supabase,
 * that user is reused instead of creating a second one.
 */
async function createAuthUser(
  email: string,
  password: string,
  fullName: string,
): Promise<{ id: string }> {
  const admin = adminClient()

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (!error && data.user) return { id: data.user.id }

    if (error && !/fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(error.message)) {
      throw new Error(`Could not create the login ${email}: ${error.message}`)
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))

    const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const existing = found?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase())
    if (existing) return { id: existing.id }
  }

  throw new Error(`Could not create the login ${email}: the network kept failing`)
}

/** Creates the owner (and therefore the shop) once per test run. */
export async function ensureOwner(): Promise<TestAccount> {
  const suffix = Date.now().toString().slice(-6)
  const password = 'owner-pass-123'
  const fullName = 'Test Owner'
  const email = `e2e-owner-${suffix}@example.com`

  const user = await createAuthUser(email, password, fullName)
  recordFixture('authUserIds', user.id)

  if (fixtureMode) {
    // The project already has a shop, and bootstrap_owner only ever runs once,
    // so this owner is attached to the existing one instead.
    const { data: shop, error: shopError } = await adminClient()
      .from('businesses')
      .select('id')
      .limit(1)
      .maybeSingle()
    if (shopError) throw new Error(`Could not read the shop: ${shopError.message}`)
    if (!shop?.id) throw new Error('E2E_FIXTURE_MODE is set but the project has no shop.')

    const { error: profileError } = await adminClient().from('profiles').insert({
      id: user.id,
      business_id: shop.id,
      role: 'owner',
      full_name: fullName,
      email,
    })
    if (profileError) throw new Error(`Could not attach the test owner: ${profileError.message}`)
    recordFixture('profileIds', user.id)

    return { role: 'owner', email, password, fullName, userId: user.id }
  }

  const { error: bootstrapError } = await adminClient().rpc('bootstrap_owner', {
    p_user_id: user.id,
    p_full_name: fullName,
    p_email: email,
    p_business_name: 'E2E Tyre Shop',
  })
  if (bootstrapError) throw new Error(`Could not create the shop: ${bootstrapError.message}`)
  recordFixture('profileIds', user.id)

  const { data: businesses } = await adminClient()
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle()
  if (businesses?.id) recordFixture('businessIds', businesses.id)

  return { role: 'owner', email, password, fullName, userId: user.id }
}

/**
 * A worker that restarts (a timed out test causes one) runs this file's
 * `beforeAll` again, which used to leave two employees with the same name in the
 * shop's staff list and make every name based locator ambiguous. Reusing the one
 * that is already there keeps a repeated run identical to the first one.
 *
 * Only applies to the default password: a test that asks for a particular
 * password, or that changes one afterwards, always needs its own account.
 */
async function existingFixtureEmployee(
  businessId: string,
  fullName: string,
): Promise<{ userId: string; employeeId: string } | null> {
  const { data: profile } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('business_id', businessId)
    .eq('full_name', fullName)
    .eq('role', 'employee')
    .maybeSingle()

  if (!profile?.id) return null

  const { data: row } = await adminClient()
    .from('employees')
    .select('id')
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!row?.id) return null

  recordFixture('profileIds', profile.id)
  recordFixture('authUserIds', profile.id)
  return { userId: profile.id, employeeId: row.id }
}

/** Creates an employee with a confirmed internal-email login and an employee record. */
export async function createEmployee(
  owner: TestAccount,
  options: {
    fullName: string
    phone: string
    monthlySalary: number
    password?: string
  },
): Promise<TestAccount> {
  const password = options.password ?? 'employee-pass-123'

  if (fixtureMode && !options.password) {
    const { data: ownerProfile } = await adminClient()
      .from('profiles')
      .select('business_id')
      .eq('id', owner.userId)
      .single()

    const existing = await existingFixtureEmployee(ownerProfile!.business_id, options.fullName)
    if (existing) {
      return {
        role: 'employee',
        phone: options.phone,
        password,
        fullName: options.fullName,
        userId: existing.userId,
        employeeId: existing.employeeId,
      }
    }
  }

  const user = await createAuthUser(newInternalEmployeeEmail(), password, options.fullName)
  recordFixture('authUserIds', user.id)

  const joinedAt = new Date().toISOString().slice(0, 10)

  if (fixtureMode) {
    const { data: ownerProfile } = await adminClient()
      .from('profiles')
      .select('business_id')
      .eq('id', owner.userId)
      .single()

    const { error: profileError } = await adminClient().from('profiles').insert({
      id: user.id,
      business_id: ownerProfile!.business_id,
      role: 'employee',
      full_name: options.fullName,
      phone: options.phone,
    })
    if (profileError)
      throw new Error(`Could not create the employee profile: ${profileError.message}`)

    const { data: employee, error: rowError } = await adminClient()
      .from('employees')
      .insert({
        business_id: ownerProfile!.business_id,
        user_id: user.id,
        monthly_salary: options.monthlySalary,
        joined_at: joinedAt,
      })
      .select('id')
      .single()
    if (rowError) throw new Error(`Could not create the employee record: ${rowError.message}`)
    recordFixture('profileIds', user.id)

    return {
      role: 'employee',
      phone: options.phone,
      password,
      fullName: options.fullName,
      userId: user.id,
      employeeId: employee.id,
    }
  }

  const ownerClient = await signedInAs(owner)
  const { data: employeeId, error: recordError } = await ownerClient.rpc('create_employee_record', {
    p_user_id: user.id,
    p_full_name: options.fullName,
    p_phone: options.phone,
    p_monthly_salary: options.monthlySalary,
    p_joined_at: joinedAt,
  })
  if (recordError) throw new Error(`Could not create the employee record: ${recordError.message}`)
  recordFixture('profileIds', user.id)

  return {
    role: 'employee',
    phone: options.phone,
    password,
    fullName: options.fullName,
    userId: user.id,
    employeeId,
  }
}

/**
 * The address an employee login is stored under, read the way the app reads it:
 * from Supabase Auth, by user id, on the server. Never returned to a browser.
 */
async function internalEmailOf(userId: string): Promise<string> {
  const { data, error } = await adminClient().auth.admin.getUserById(userId)
  if (error || !data.user?.email) {
    throw new Error(`Could not read the login identity: ${error?.message ?? 'no email'}`)
  }
  return data.user.email
}

/**
 * Notes an employee that the app itself created through the owner screen, so the
 * teardown removes it again. The app makes that login with the elevated key and
 * the tests have no other way to learn its user id.
 */
export async function recordEmployeeCreatedInApp(fullName: string): Promise<string | null> {
  // The name lives on `profiles`; `employees` only holds the employment record.
  const { data: profile } = await adminClient()
    .from('profiles')
    .select('id')
    .eq('full_name', fullName)
    .eq('role', 'employee')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profile?.id) return null
  recordFixture('profileIds', profile.id)
  recordFixture('authUserIds', profile.id)
  return profile.id
}

export async function signedInAs(account: TestAccount): Promise<SupabaseClient> {
  const client = anonClient()
  const { error } = account.email
    ? await client.auth.signInWithPassword({ email: account.email, password: account.password })
    : await client.auth.signInWithPassword({
        email: await internalEmailOf(account.userId),
        password: account.password,
      })
  if (error) throw new Error(`Sign in failed for ${account.fullName}: ${error.message}`)
  return client
}

/**
 * Signs in through the UI, the way a person does.
 *
 * `landsOn` defaults to a working home screen, but a disabled employee is sent
 * to /no-access, which is the behaviour that test needs to see.
 */
export async function signInThroughUi(
  page: import('@playwright/test').Page,
  account: TestAccount,
  landsOn: RegExp = /\/(owner|employee)/,
): Promise<void> {
  // Start from a clean session: the app sends a signed in person away from
  // /login, so a test that switches accounts without signing out would never
  // see the sign in form at all.
  await page.context().clearCookies()
  await page.goto('/login')

  if (account.email) {
    await page.getByRole('tab', { name: 'Shop owner' }).click()
    await page.getByLabel('Email').fill(account.email)
  } else {
    await page.getByRole('tab', { name: 'Employee' }).click()
    await page.getByLabel('Mobile number').fill((account.phone ?? '').replace('+91', ''))
  }

  await page.getByLabel('Password', { exact: true }).fill(account.password)

  // The sign in service occasionally drops a request from this network. The app
  // now says so instead of claiming the password is wrong, so retrying is both
  // correct and a check of that message being there at all.
  for (let attempt = 1; ; attempt += 1) {
    await page.getByRole('button', { name: 'Sign in' }).click()
    const landed = await page
      .waitForURL(landsOn, { timeout: attempt === 3 ? 30_000 : 15_000 })
      .then(() => true)
      .catch(() => false)

    if (landed) return
    if (attempt >= 3) throw new Error(`Could not sign in as ${account.fullName} (landed on ${page.url()})`)

    const unreachable = await page
      .getByText('We could not reach the sign in service')
      .isVisible()
      .catch(() => false)
    if (!unreachable) return
  }
}
