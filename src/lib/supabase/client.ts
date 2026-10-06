'use client'

import { createBrowserClient } from '@supabase/ssr'

import { supabasePublishableKey, supabaseUrl } from '@/lib/env'
import type { Database } from '@/lib/database.types'

let cached: ReturnType<typeof createBrowserClient<Database>> | undefined

/**
 * Supabase client for Client Components. It reads the session from the browser
 * cookies set by the server client, so the same RLS policies apply.
 */
export function createClient() {
  cached ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey)
  return cached
}