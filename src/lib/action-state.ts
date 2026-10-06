/** Result shape shared by every form that talks to a server action. */
export type ActionState = {
  status: 'idle' | 'error' | 'success'
  message?: string
  /** `{ fieldName: message }`, used to show an error under each input. */
  errors?: Record<string, string>
}

export const idleState: ActionState = { status: 'idle' }

export function actionError(message: string, errors?: Record<string, string>): ActionState {
  return { status: 'error', message, errors }
}

export function actionSuccess(message: string): ActionState {
  return { status: 'success', message }
}

/**
 * Postgres raises the same message for every unique violation, so a duplicate
 * phone or email cannot be told apart by the client. Turn the ones we expect
 * into something a shop owner can act on.
 */
export function humanizeDatabaseError(message: string): string {
  const text = message.toLowerCase()

  if (text.includes('duplicate key') || text.includes('already exists')) {
    if (text.includes('phone')) return 'That mobile number is already linked to someone else.'
    if (text.includes('email')) return 'That email address is already registered.'
    if (text.includes('bill')) return 'That bill number already exists. Please try again.'
    return 'That record already exists.'
  }
  if (text.includes('profiles_phone_key')) return 'That mobile number is already linked to someone else.'
  if (text.includes('profiles_email_key')) return 'That email address is already registered.'
  if (text.includes('monthly salary cannot be less')) return 'The monthly salary cannot be below what is already paid.'
  if (text.includes('salary payment details cannot be changed')) return 'That salary payment can no longer be edited.'
  if (text.includes('not waiting for your acceptance')) return 'That payment has already been accepted.'
  if (text.includes('already confirmed') || text.includes('is already')) return 'That payment has already been accepted.'
  if (text.includes('only the employee can accept')) return 'Only the employee can accept this payment.'
  if (text.includes('only the shop owner can cancel')) return 'Only the shop owner can cancel a payment.'
  if (text.includes('only the owner')) return 'Only the shop owner can do this.'
  if (text.includes('not linked to a shop')) return 'Your account is not linked to this shop.'
  if (text.includes('employee login and shop cannot be changed')) return 'The login linked to an employee cannot be changed.'
  if (text.includes('billing') && text.includes('disabled')) return 'Your access has been disabled. Contact the shop owner.'
  if (text.includes('shop is already set up')) return 'This shop is already set up. Please sign in as the owner.'
  if (text.includes('row-level security') || text.includes('permission denied')) {
    return 'You do not have permission to do that.'
  }

  return message
}