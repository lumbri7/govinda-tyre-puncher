'use server'

import { revalidatePath } from 'next/cache'

import { type ActionState, actionError, humanizeDatabaseError } from '@/lib/action-state'
import { requireSession } from '@/lib/auth'
import { fieldErrors, updatePasswordSchema } from '@/lib/validation'
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
  await requireSession()

  const parsed = updatePasswordSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  })
  if (!parsed.success) return actionError('Check the passwords and try again.', fieldErrors(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return actionError(humanizeDatabaseError(error.message))

  return { status: 'success', message: 'Password changed.' }
}
