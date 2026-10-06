'use server'

import { redirect } from 'next/navigation'

import { type ActionState, actionError, actionSuccess, humanizeDatabaseError } from '@/lib/action-state'
import { getSession } from '@/lib/auth'
import { INTERNAL_IDENTITY_DOMAIN } from '@/lib/employee-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  forgotPasswordSchema,
  ownerLoginSchema,
  ownerSignupSchema,
  employeeLoginSchema,
  updatePasswordSchema,
  fieldErrors,
} from '@/lib/validation'

/** One answer for every way a sign in can fail. */
const GENERIC_LOGIN_ERROR = 'Mobile number or password is incorrect.'

/**
 * The internal address an employee's login is stored under.
 *
 * For an unknown number this returns a well formed address that cannot belong
 * to anyone, so the caller cannot tell the two cases apart from the outside.
 */
function unknownEmployeeAuthEmail(): string {
  return `employee-${crypto.randomUUID()}@${INTERNAL_IDENTITY_DOMAIN}`
}

/**
 * Phone number -> the address Supabase Auth knows the employee by.
 *
 * Two privileged reads, both server side only: the lookup runs as
 * `service_role`, which is the one role allowed to call
 * `public.employee_auth_user_id`, and the address itself is read from Supabase
 * Auth by user id. Neither the address nor the user id is ever sent to the
 * browser. See src/lib/employee-identity.ts for why employee logins are
 * addresses at all.
 */
async function resolveEmployeeAuthEmail(phone: string): Promise<string | null> {
  const admin = createAdminClient()

  const { data: userId, error } = await admin.rpc('employee_auth_user_id', {
    p_phone: phone,
  })
  // An error here is the database not answering, which is not the same as "no
  // such number": null means "ask them to try again".
  if (error) return null
  if (!userId) return unknownEmployeeAuthEmail()

  const { data, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError) return null
  if (!data.user?.email) return unknownEmployeeAuthEmail()

  return data.user.email
}

/**
 * A shop on mobile data loses connections, and a lost connection is not a wrong
 * password. Try once more, and if the service still cannot be reached, say so:
 * telling an employee their number or password is incorrect because our own
 * request failed is both untrue and impossible to debug from their side.
 */
async function signInWithPassword(
  supabase: Awaited<ReturnType<typeof createClient>>,
  email: string,
  password: string,
) {
  let result = await supabase.auth.signInWithPassword({ email, password })

  if (result.error && isTransportFailure(result.error)) {
    result = await supabase.auth.signInWithPassword({ email, password })
  }

  return {
    data: result.data,
    error: result.error,
    unreachable: Boolean(result.error && isTransportFailure(result.error)),
  }
}

/** Auth answers a wrong password with a status; it never answers at all otherwise. */
function isTransportFailure(error: { status?: number; message: string }): boolean {
  if (typeof error.status === 'number' && error.status > 0) return false
  return /fetch failed|failed to fetch|network|load failed|timeout|socket|ECONNRESET|EAI_AGAIN/i.test(
    error.message,
  )
}

const SERVICE_UNREACHABLE = 'We could not reach the sign in service. Please try again.'

function values(formData: FormData) {
  return {
    fullName: String(formData.get('fullName') ?? ''),
    businessName: String(formData.get('businessName') ?? ''),
    email: String(formData.get('email') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  }
}

export async function signInOwner(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ownerLoginSchema.safeParse(values(formData))
  if (!parsed.success) return actionError('Check the details and try again.', fieldErrors(parsed.error))

  const supabase = await createClient()
  const { error, unreachable } = await signInWithPassword(
    supabase,
    parsed.data.email,
    parsed.data.password,
  )

  if (error) {
    if (unreachable) return actionError(SERVICE_UNREACHABLE)
    // The same message for a wrong email and a wrong password on purpose: this
    // must not tell an attacker which shop owners exist.
    return actionError('Email or password is incorrect.')
  }

  redirect('/owner')
}

/**
 * Employee sign in: mobile number and password, nothing else.
 *
 * Supabase Auth knows the employee only by the internal address created with
 * the login, so this action resolves number -> employee -> Auth user -> that
 * address on the server, then signs in through the ordinary cookie based
 * client. The address is never returned to the browser, and no step of it can be
 * called with the publishable key.
 */
export async function signInEmployee(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = employeeLoginSchema.safeParse(values(formData))
  if (!parsed.success) return actionError('Check the details and try again.', fieldErrors(parsed.error))

  const authEmail = await resolveEmployeeAuthEmail(parsed.data.phone)
  if (!authEmail) return actionError(SERVICE_UNREACHABLE)

  const supabase = await createClient()
  // Runs for a number nobody has too, against an address that cannot exist, so
  // an unknown number costs the same and returns the same message as a wrong
  // password: this form must not answer "does this number exist?".
  const { data, error, unreachable } = await signInWithPassword(
    supabase,
    authEmail,
    parsed.data.password,
  )

  if (error || !data.user) {
    // Never shown to the employee. This is the only place the underlying reason
    // is visible: "invalid login credentials" and "no such number" would
    // otherwise be indistinguishable when debugging.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[auth] employee sign in failed: ${error?.message ?? 'no error'}`)
    }
    // A request that never reached Auth says nothing about the password.
    if (unreachable) return actionError(SERVICE_UNREACHABLE)
    return actionError(GENERIC_LOGIN_ERROR)
  }

  // A signed in account can still be unprovisioned (disabled by the owner, or
  // not linked to a shop yet). Sign it back out instead of showing an empty app.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile?.is_active) {
    await supabase.auth.signOut()
    return actionError(GENERIC_LOGIN_ERROR)
  }

  redirect(profile.role === 'owner' ? '/owner' : '/employee')
}

export async function signUpOwner(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = ownerSignupSchema.safeParse(values(formData))
  if (!parsed.success) return actionError('Check the details and try again.', fieldErrors(parsed.error))

  const { fullName, businessName, email, password } = parsed.data
  const admin = createAdminClient()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createError || !created.user) {
    if (createError?.message.toLowerCase().includes('already')) {
      return actionError('That email address is already registered. Please sign in instead.')
    }
    return actionError(humanizeDatabaseError(createError?.message ?? 'Could not create the account.'))
  }

  // Creates the shop and the owner profile in one transaction. It refuses to
  // run when the shop already exists, so this page cannot be replayed.
  const { error: bootstrapError } = await admin.rpc('bootstrap_owner', {
    p_user_id: created.user.id,
    p_full_name: fullName,
    p_email: email,
    p_business_name: businessName,
  })

  if (bootstrapError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return actionError(humanizeDatabaseError(bootstrapError.message))
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
  if (signInError) return actionError('Account created. Please sign in.')

  redirect('/owner')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(values(formData))
  if (!parsed.success) return actionError('Enter a valid email address.', fieldErrors(parsed.error))

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/update-password`,
  })

  // Always the same answer, so this page cannot be used to find owner emails.
  return actionSuccess('If that email is registered, a reset link is on its way.')
}

export async function updatePassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(values(formData))
  if (!parsed.success) return actionError('Check the passwords and try again.', fieldErrors(parsed.error))

  const session = await getSession()
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error) return actionError(humanizeDatabaseError(error.message))

  // This device signed in with the old password, so it has to be signed out as
  // well: end every session (see migration 00700) and drop the refresh tokens,
  // otherwise a link that leaked in an old inbox would still work.
  if (session) {
    const admin = createAdminClient()
    await admin
      .from('profiles')
      .update({ session_invalid_before: new Date().toISOString() })
      .eq('id', session.userId)
    await admin.auth.admin.signOut(session.userId, 'global')
  }

  await supabase.auth.signOut()
  redirect('/login?reset=1')
}