'use server'

import { revalidatePath } from 'next/cache'

import { requireEmployee } from '@/lib/auth'
import { type ActionState, actionError, actionSuccess, humanizeDatabaseError } from '@/lib/action-state'
import { createClient } from '@/lib/supabase/server'

/** Employee accepts a salary payment the owner recorded. */
export async function acceptSalaryPayment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireEmployee()

  const paymentId = String(formData.get('paymentId') ?? '')
  if (!paymentId) return actionError('This payment could not be found.')

  const supabase = await createClient()
  // Only the employee the payment belongs to can accept: the database rejects
  // anyone else, and RLS hides the row before we even get here.
  const { error } = await supabase.rpc('accept_salary_payment', { p_payment_id: paymentId })

  // Swallowing this would leave the employee believing they had accepted money
  // the shop never recorded, which is exactly the argument this screen exists
  // to prevent.
  if (error) return actionError(humanizeDatabaseError(error.message))

  revalidatePath('/employee/salary')
  revalidatePath('/employee')

  return actionSuccess('Payment accepted. Thank you.')
}
