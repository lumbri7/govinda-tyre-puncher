import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/lib/database.types'
import { DEFAULT_TIMEZONE } from '@/lib/dates'
import { perfLog } from '@/lib/perf'

export type Session = {
  userId: string
  email: string | null
  phone: string | null
  phoneConfirmed: boolean
  fullName: string
  role: AppRole
  businessId: string
  businessName: string
  timezone: string
  employeeId: string | null
}

/**
 * The verified caller. `getClaims()` verifies the JWT signature against the
 * project's signing key, so the user id below cannot be forged from a cookie.
 *
 * `issuedAt` is the token's own `iat`, which is what a password change is
 * compared against: Auth keeps handing out access tokens after a password
 * reset, so the mark has to be checked against the token, not the password.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (error || !claims?.sub) return null
  return {
    id: claims.sub,
    issuedAt: typeof claims.iat === 'number' ? claims.iat * 1000 : null,
  }
})

/** True when the session predates a password change or a lockout. */
function sessionIsStale(issuedAt: number | null, invalidBefore: string | null): boolean {
  if (invalidBefore === null || issuedAt === null) return false
  return issuedAt < Date.parse(invalidBefore)
}

/**
 * Signed in *and* provisioned: a `profiles` row exists, which is the only
 * place a role is stored. Everything downstream reads data through RLS, so a
 * session without a profile sees nothing at all.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // Aimed at the 8–10 s navigation report: this isolates how much of a render is
  // the token verify, the profile lookup and the two follow-up lookups. Off
  // unless PERF_LOG=1, and it never logs identifiers.
  const startedAt = performance.now()

  const user = await getAuthUser()
  if (!user) {
    perfLog('getSession', { result: 'anonymous', total: performance.now() - startedAt })
    return null
  }
  const authAt = performance.now()

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, business_id, role, full_name, phone, email, is_active, session_invalid_before')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile || !profile.is_active) {
    perfLog('getSession', { result: 'no-profile', total: performance.now() - startedAt })
    return null
  }
  // A password change ends the sessions it was supposed to end.
  if (sessionIsStale(user.issuedAt, profile.session_invalid_before)) {
    perfLog('getSession', { result: 'stale', total: performance.now() - startedAt })
    return null
  }
  const profileAt = performance.now()

  // The business row and (for employees) the employee row only depend on the
  // profile, so they run together instead of as two sequential round trips.
  const [businessResult, employeeResult] = await Promise.all([
    supabase.from('businesses').select('name, timezone').eq('id', profile.business_id).maybeSingle(),
    profile.role === 'employee'
      ? supabase
          .from('employees')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const business = businessResult.data
  const employee = employeeResult.data

  perfLog('getSession', {
    role: profile.role,
    auth: authAt - startedAt,
    profile: profileAt - authAt,
    linked: performance.now() - profileAt,
    total: performance.now() - startedAt,
  })

  return {
    userId: profile.id,
    email: profile.email,
    phone: profile.phone,
    phoneConfirmed: Boolean(profile.phone),
    fullName: profile.full_name,
    role: profile.role,
    businessId: profile.business_id,
    businessName: business?.name ?? 'This shop',
    timezone: business?.timezone ?? DEFAULT_TIMEZONE,
    employeeId: employee?.id ?? null,
  }
})

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (session) return session

  // Signed in to Auth, but there is no active profile: a disabled employee or a
  // half created account. Sending these people back to /login would trap them
  // in a loop (the proxy bounces signed-in users away from /login), so they get
  // a page that explains the situation and lets them sign out.
  if (await getAuthUser()) redirect('/no-access')
  redirect('/login')
}

export async function requireOwner(): Promise<Session & { role: 'owner' }> {
  const session = await requireSession()
  if (session.role !== 'owner') redirect('/employee')
  return session as Session & { role: 'owner' }
}

export async function requireEmployee(): Promise<Session & { role: 'employee'; employeeId: string }> {
  const session = await requireSession()
  if (session.role !== 'employee' || !session.employeeId) redirect('/owner')
  return session as Session & { role: 'employee'; employeeId: string }
}

/** Home route for a role. */
export function homeFor(role: AppRole): string {
  return role === 'owner' ? '/owner' : '/employee'
}