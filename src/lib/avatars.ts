import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

/** Bundled, license-safe illustrated avatars a shop owner can pin to staff. */
export const AVATAR_KEYS = ['cap', 'curls', 'glasses', 'moustache', 'headband', 'goggles'] as const
export type AvatarKey = (typeof AVATAR_KEYS)[number]

export const AVATAR_LABELS: Record<AvatarKey, string> = {
  cap: 'Black cap',
  curls: 'Curly hair',
  glasses: 'Glasses',
  moustache: 'Moustache',
  headband: 'Headband',
  goggles: 'Goggles',
}

export function isAvatarKey(value: unknown): value is AvatarKey {
  return typeof value === 'string' && (AVATAR_KEYS as readonly string[]).includes(value)
}

/** Up to two initials for the fallback circle. */
export function initialsOf(name: string | null | undefined): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '?'
  const parts = trimmed.split(/\s+/)
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export type SafeProfile = {
  id: string
  full_name: string | null
  phone?: string | null
  avatar: string | null
}

const AVATAR_COLUMN_MISSING = /avatar/i

/**
 * Reads profiles plus the avatar column, degrading cleanly while the (manual)
 * `profiles.avatar` migration has not been applied to a database yet. Returns
 * whether the column is live so callers can hide avatar-only UI if needed.
 */
export async function readProfiles(
  supabase: SupabaseClient<Database>,
  ids: string[],
  columns: string = 'full_name',
): Promise<{ profiles: SafeProfile[]; avatarAvailable: boolean }> {
  const cleanIds = [...new Set(ids)].filter((id): id is string => Boolean(id))
  if (cleanIds.length === 0) return { profiles: [], avatarAvailable: true }

  const base = `id, ${columns}`
  const { data, error } = await supabase.from('profiles').select(`${base}, avatar`).in('id', cleanIds)

  if (data) {
    return { profiles: data as unknown as SafeProfile[], avatarAvailable: true }
  }

  if (error && AVATAR_COLUMN_MISSING.test(error.message)) {
    const { data: fallback } = await supabase.from('profiles').select(base).in('id', cleanIds)
    return {
      profiles: (fallback ?? []).map((profile) => ({
        ...(profile as unknown as SafeProfile),
        avatar: null,
      })),
      avatarAvailable: false,
    }
  }

  return { profiles: [], avatarAvailable: false }
}

/**
 * Persists an avatar choice for a profile. Returns true even while the avatar
 * column does not exist yet, so the owner edit flow is never blocked in front
 * of the manual migration.
 */
export async function updateProfileAvatar(
  supabase: SupabaseClient<Database>,
  userId: string,
  avatar: string | null,
): Promise<boolean> {
  const { error } = await supabase.from('profiles').update({ avatar }).eq('id', userId)
  if (!error) return true
  if (AVATAR_COLUMN_MISSING.test(error.message)) return true
  return false
}