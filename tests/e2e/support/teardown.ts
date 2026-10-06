import { createClient } from '@supabase/supabase-js'

import { removeFixtures } from './fixture-manifest'

/**
 * Runs once after the whole suite and removes everything the run created, so the
 * E2E project is left exactly as it was found. Safe to run when nothing was
 * recorded.
 */
export default async function globalTeardown(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await removeFixtures(admin)
  console.log(`[e2e] fixture teardown: ${result}`)
}