import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * What a test run created, so the global teardown can put the project back.
 *
 * Kept out of git (tests/e2e/.fixtures.json is ignored) because it holds ids
 * and the teardown needs them after every spec file has exited.
 */
const MANIFEST = join(process.cwd(), 'tests', 'e2e', '.fixtures.json')

export type FixtureManifest = {
  authUserIds: string[]
  profileIds: string[]
  businessIds: string[]
}

function read(): FixtureManifest {
  if (!existsSync(MANIFEST)) return { authUserIds: [], profileIds: [], businessIds: [] }
  try {
    return { authUserIds: [], profileIds: [], businessIds: [], ...JSON.parse(readFileSync(MANIFEST, 'utf8')) }
  } catch {
    return { authUserIds: [], profileIds: [], businessIds: [] }
  }
}

function write(manifest: FixtureManifest): void {
  mkdirSync(dirname(MANIFEST), { recursive: true })
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

export function recordFixture(kind: keyof FixtureManifest, id: string): void {
  const manifest = read()
  if (!manifest[kind].includes(id)) manifest[kind].push(id)
  write(manifest)
}

/**
 * Removes everything the run created, children first: bills point at the
 * profile that made them with no cascade, so they have to go first.
 */
export async function removeFixtures(admin: SupabaseClient): Promise<string> {
  if (!existsSync(MANIFEST)) return 'no fixtures recorded'
  const manifest = read()

  if (manifest.profileIds.length > 0) {
    await admin.from('bills').delete().in('created_by', manifest.profileIds)
    await admin.from('salary_payments').delete().in('created_by', manifest.profileIds)
    await admin.from('businesses').delete().in('id', manifest.businessIds)
  }

  for (const userId of manifest.authUserIds) {
    await admin.auth.admin.deleteUser(userId)
  }

  write({ authUserIds: [], profileIds: [], businessIds: [] })
  return `removed ${manifest.authUserIds.length} logins and ${manifest.profileIds.length} profiles`
}

export function manifestPath(): string {
  return MANIFEST
}