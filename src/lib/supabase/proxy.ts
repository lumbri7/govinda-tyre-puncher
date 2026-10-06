import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { supabasePublishableKey, supabaseUrl } from '@/lib/env'
import type { AppRole, Database } from '@/lib/database.types'

/** Routes that require a signed-in user. */
const PROTECTED = ['/owner', '/employee']
/** Routes a signed-in user has no reason to see. */
const AUTH_ROUTES = ['/login', '/setup', '/forgot-password']

/**
 * Keeps the auth cookies fresh and stops signed-out visitors from reaching the
 * owner and employee areas. Authorisation (owner vs employee) is enforced in
 * the layouts with Postgres row level security, not here.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // Must run before any redirect: getClaims() also refreshes an expired token,
  // which writes new cookies through setAll() above.
  const { data, error } = await supabase.auth.getClaims()
  let signedIn = Boolean(data?.claims?.sub) && !error
  let role: AppRole | null = null
  /** Cookies of a session a password change has already ended. */
  let ended: string[] = []

  if (signedIn) {
    // One indexed lookup, and it earns its keep: the role decides where the home
    // route points, and a session that predates a password change is over even
    // though Auth still accepts the token.
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active, session_invalid_before')
      .eq('id', data!.claims!.sub as string)
      .maybeSingle()

    const issuedAt = typeof data!.claims!.iat === 'number' ? data!.claims!.iat * 1000 : null
    const stale =
      profile?.session_invalid_before !== null &&
      profile?.session_invalid_before !== undefined &&
      issuedAt !== null &&
      issuedAt < Date.parse(profile.session_invalid_before)

    if (stale) {
      // Keep the browser from replaying a dead session on every later request,
      // and make the visitor sign in again rather than loop between /login and
      // the page they asked for.
      ended = request.cookies
        .getAll()
        .map(({ name }) => name)
        .filter((name) => name.startsWith('sb-'))
      signedIn = false
    } else if (profile?.is_active) {
      role = profile.role
    }
  }

  const { pathname } = request.nextUrl
  /** Redirects built here have to carry the expired cookies out with them. */
  const redirectTo = (url: URL) => {
    const target = NextResponse.redirect(url)
    for (const name of ended) target.cookies.delete(name)
    return target
  }

  if (!signedIn && (pathname === '/' || PROTECTED.some((prefix) => pathname.startsWith(prefix)))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    // The sign in form sends people to their home screen after signing in, so
    // the reason is all worth passing on here.
    url.search =
      ended.length > 0
        ? '?reason=session-ended'
        : pathname === '/'
          ? ''
          : `?next=${encodeURIComponent(pathname)}`
    return redirectTo(url)
  }

  if (signedIn && pathname === '/') {
    // Resolve the home screen here rather than in the page, so a browser never
    // gets a 200 that has to redirect itself.
    const url = request.nextUrl.clone()
    url.pathname = role === 'owner' ? '/owner' : role === 'employee' ? '/employee' : '/no-access'
    url.search = ''
    return redirectTo(url)
  }

  if (signedIn && AUTH_ROUTES.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = role === 'owner' ? '/owner' : '/employee'
    url.search = ''
    return redirectTo(url)
  }

  for (const name of ended) response.cookies.delete(name)
  return response
}