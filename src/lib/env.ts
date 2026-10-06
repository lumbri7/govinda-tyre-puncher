// Only NEXT_PUBLIC_* values belong here: they are inlined into the browser
// bundle at build time, so each one must be read with a literal
// `process.env.NEXT_PUBLIC_X` access. A computed lookup such as
// `process.env[name]` is never inlined and resolves to an empty object in the
// browser, which breaks every client component that imports this module.
// Server-only secrets are not read here on purpose; they stay in
// src/lib/supabase/admin.ts, which is marked `server-only`.
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    )
  }
  return value
}

/** Supabase project URL, safe to expose to the browser. */
export const supabaseUrl = required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL')

/**
 * Supabase publishable (anon) key. Only ever used for signed-in, RLS-checked
 * requests. The service role key lives in lib/supabase/admin.ts and is
 * server-only.
 */
export const supabasePublishableKey = required(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
)