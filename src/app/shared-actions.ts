'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { type ActionState, actionError, humanizeDatabaseError } from '@/lib/action-state'
import { requireSession } from '@/lib/auth'
import { fieldErrors, updatePasswordSchema } from '@/lib/validation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** Actions both roles need. Marking a notification read is RLS protected: a
 * user can only flip rows where `user_id` is their own. */
export async function markNotificationRead(formData: FormData): Promise<void> {
  await requireSession()

  const id = String(formData.get('notificationId') ?? '')
  if (!id) return

  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('id', id)

  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead(): Promise<void> {
  await requireSession()

  const supabase = await createClient()
  await supabase.from('notifications').update({ is_read: true }).eq('is_read', false)

  revalidatePath('/', 'layout')
}

/** Used by both the employee "Me" screen and the owner settings screen. */
export async function changeOwnPassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession()

  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })
  if (!parsed.success) return actionError('Check the passwords and try again.', fieldErrors(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return actionError(humanizeDatabaseError(error.message))

  // A changed password does not end the sessions that were handed out under the
  // old one: the access token in the cookie stays valid until it expires, and a
  // refresh token copied earlier still works. This is the same treatment the
  // owner's reset applies (see migration 00700): stamp the moment sessions
  // became invalid, revoke the refresh tokens at Auth, and drop this one.
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({ session_invalid_before: new Date().toISOString() })
    .eq('id', session.userId)
  await admin.auth.admin.signOut(session.userId, 'global')
  await supabase.auth.signOut()

  redirect('/login?reason=session-ended')
}
