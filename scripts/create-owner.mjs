#!/usr/bin/env node
/**
 * Creates the first owner account and the shop, from the command line.
 *
 * Useful for provisioning a brand new Supabase project before the UI exists,
 * and for automated environments. It calls the same `bootstrap_owner` RPC the
 * setup page uses, which refuses to run when a shop already exists.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SECRET_KEY=... \
 *   OWNER_EMAIL=owner@example.com OWNER_PASSWORD=... OWNER_NAME="..." SHOP_NAME="..." \
 *   node scripts/create-owner.mjs
 *
 * `SUPABASE_SERVICE_ROLE_KEY` is still accepted for projects created before the
 * key rename.
 */

import { createClient } from '@supabase/supabase-js'

const {
  NEXT_PUBLIC_SUPABASE_URL: url,
  SUPABASE_SECRET_KEY: secretKey,
  SUPABASE_SERVICE_ROLE_KEY: legacyKey,
  OWNER_EMAIL: email,
  OWNER_PASSWORD: password,
  OWNER_NAME: fullName,
  SHOP_NAME: shopName = 'Govinda Tyre Puncture',
} = process.env

const serviceRoleKey = secretKey ?? legacyKey

const missing = ['NEXT_PUBLIC_SUPABASE_URL', 'OWNER_EMAIL', 'OWNER_PASSWORD', 'OWNER_NAME'].filter(
  (key) => !process.env[key],
)
if (!serviceRoleKey) missing.push('SUPABASE_SECRET_KEY')
if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: created, error: createError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
})

if (createError) {
  console.error(`Could not create the login: ${createError.message}`)
  process.exit(1)
}

const { error: bootstrapError } = await admin.rpc('bootstrap_owner', {
  p_user_id: created.user.id,
  p_full_name: fullName,
  p_email: email,
  p_business_name: shopName,
})

if (bootstrapError) {
  // Never leave a login that cannot sign in to anything.
  await admin.auth.admin.deleteUser(created.user.id)
  console.error(`Could not create the shop: ${bootstrapError.message}`)
  process.exit(1)
}

console.log(`Shop "${shopName}" created. Owner: ${email}`)