#!/usr/bin/env node
/**
 * Moves employee logins from Supabase phone auth to the internal email identity
 * the app now uses (see src/lib/employee-identity.ts).
 *
 * What it does, per employee login that has a phone number and no internal
 * address yet:
 *
 *   1. assigns a fresh `employee-<uuid>@auth.govindatyrepuncture.internal`
 *      address, confirmed, on the SAME Supabase Auth user;
 *   2. leaves the password untouched.
 *
 * What it deliberately does not do: delete a user, recreate a user, generate or
 * change a password, touch an owner login, or touch a profile, employee, bill
 * or salary row. The Auth user id, the profile row and the employee row are all
 * preserved, so existing bills and salary history keep pointing at the same
 * person, and the employee's current password keeps working. Running it twice
 * does nothing the second time.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SECRET_KEY=... \
 *   node scripts/migrate-employee-auth.mjs
 *
 * Add --dry-run to see what would change without changing it.
 */

import { createClient } from '@supabase/supabase-js'

const INTERNAL_IDENTITY_DOMAIN = 'auth.govindatyrepuncture.internal'
const newInternalEmployeeEmail = () => `employee-${crypto.randomUUID()}@${INTERNAL_IDENTITY_DOMAIN}`
const isInternalEmail = (email) => typeof email === 'string' && email.endsWith(`@${INTERNAL_IDENTITY_DOMAIN}`)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const dryRun = process.argv.includes('--dry-run')

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY.')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Phone numbers are personal data: only ever shown as the last two digits. */
const mask = (phone) => (phone ? `…${String(phone).slice(-2)}` : 'none')

const pageSize = 200
let migrated = 0
let alreadyDone = 0
let skipped = 0
let failed = 0

for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize })
  if (error) {
    console.error(`Could not list Auth users: ${error.message}`)
    process.exit(1)
  }

  for (const user of data.users) {
    if (isInternalEmail(user.email)) {
      alreadyDone += 1
      continue
    }
    if (user.email) {
      // A real address: this is the shop owner or a manually created login.
      // Owners must keep signing in with the address they know.
      skipped += 1
      continue
    }
    if (!user.phone) {
      skipped += 1
      continue
    }

    console.log(
      `${dryRun ? 'would migrate' : 'migrating'} Auth user ${user.id} (phone ${mask(user.phone)})`,
    )

    if (dryRun) {
      migrated += 1
      continue
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email: newInternalEmployeeEmail(),
      email_confirm: true,
    })

    if (updateError) {
      failed += 1
      console.error(`  failed: ${updateError.message}`)
      continue
    }

    migrated += 1
  }

  if (data.users.length < pageSize) break
}

console.log(
  [
    dryRun ? 'Dry run, nothing was changed.' : 'Done.',
    `assigned an internal address: ${migrated}`,
    `already had one: ${alreadyDone}`,
    `left alone (owner or non employee login): ${skipped}`,
    `failed: ${failed}`,
  ].join('\n'),
)

if (!dryRun && migrated > 0) {
  console.log(
    '\nEach migrated employee signs in with their mobile number and the password they already had.\n' +
      'If an employee has forgotten theirs, the shop owner resets it on the employee screen:\n' +
      '/owner/employees -> open the employee -> New password. No password was generated here.',
  )
}

process.exit(failed > 0 ? 1 : 0)