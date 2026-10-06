import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { supabaseUrl } from '@/lib/env'
import type { Database } from '@/lib/database.types'

/**
 * Elevated Supabase key, server side only.
 *
 * Supabase's current name is `SUPABASE_SECRET_KEY`; projects created before the
 * rename still use `SUPABASE_SERVICE_ROLE_KEY`. The new name wins when both are
 * present, so a project can be migrated by adding one variable and removing the
 * old one whenever it suits. Neither is ever exposed to the browser.
 */
function elevatedKey(): string {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (secretKey) return secretKey

  const legacyKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (legacyKey) return legacyKey

  throw new Error(
    'Missing environment variable SUPABASE_SECRET_KEY (or the legacy SUPABASE_SERVICE_ROLE_KEY). ' +
      'The elevated key is only available on the server.',
  )
}

/**
 * Elevated client. This bypasses row level security, so it is only ever created
 * inside Server Actions / Route Handlers that the user is already authorised in,
 * never in a Client Component.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl, elevatedKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}