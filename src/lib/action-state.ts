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
 *
 * The final fallthrough matters as much: an unmapped database error can be a
 * constraint name, an English fragment of SQL or a transport message, and none
 * of those belongs on a screen. Anything not recognised becomes one calm,
 * accurate sentence instead of internals.
 */
export function humanizeDatabaseError(
  message: string,
  fallback = 'Something went wrong while saving. Nothing was changed. Please try again.',
): string {
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
  if (text.includes('has already been voided')) return 'This bill has already been voided.'
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

  // Everything a function `raise`s on purpose is written to be shown as is;
  // keep those, and only those.
  if (isDeliberateMessage(text)) return message

  return fallback
}

/**
 * The database functions raise their own, human-written sentences for the
 * cases a clerk can actually hit ("Add at least one item to the bill."). A
 * message that is one of those reads and behaves like one; anything else is
 * PostgREST or the transport layer and is not shown.
 */
function isDeliberateMessage(text: string): boolean {
  const deliberate = [
    'customer name is required',
    'please choose the vehicle type',
    'vehicle number is not valid',
    'describe the vehicle',
    'that vehicle description is too long',
    'mobile number is not valid',
    'no items were added to the bill',
    'add at least one item to the bill',
    'a bill can have at most 50 items',
    'unknown item type',
    'item name is required',
    'quantity is not valid for',
    'price is not valid for',
    'enter a short reason for voiding this bill',
    'enter a reason for voiding this bill',
    'employee not found',
    'enter a valid amount',
    'payment date is not valid',
    'note is too long',
    'employee name is not valid',
    'monthly salary is not valid',
    'your mobile number already has a login in this shop',
    'that mobile number already has a login in this shop',
    'this is more than the remaining salary',
    'could not save the bill',
    'bill not found',
  ]
  return deliberate.some((needle) => text.includes(needle))
}