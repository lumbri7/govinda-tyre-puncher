import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { supabasePublishableKey, supabaseUrl } from '@/lib/env'
import type { Database } from '@/lib/database.types'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 * Reads and writes the session from the request cookies so that the RLS
 * policies in Postgres see the signed-in user.
 *
 * Only the publishable key is ever used here: every statement is still subject
 * to row level security.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session on the next request, so swallowing this is safe.
        }
      },
    },
  })
}