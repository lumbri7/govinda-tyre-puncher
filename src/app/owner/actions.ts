'use server'

import { revalidatePath } from 'next/cache'

import { type ActionState, actionError, actionSuccess, humanizeDatabaseError } from '@/lib/action-state'
import { requireOwner } from '@/lib/auth'
import {
  employeeFormSchema,
  fieldErrors,
  salaryPaymentSchema,
  toSalaryNumber,
  updatePasswordSchema,
} from '@/lib/validation'
import { newInternalEmployeeEmail } from '@/lib/employee-identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** One year, the longest ban Supabase accepts. */
const BAN_DURATION = '876000h'

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

/**
 * Creates the employee login and the employee record together.
 *
 * The owner chooses the first password and reads it out to the employee. It is
 * passed straight to Supabase Auth and is never stored, logged or returned by
 * this action; the employee can change it from their own "Me" screen.
 *
 * The login itself is an internal email identity, not the phone number: the
 * phone stays business data the owner can correct, and the app never depends
 * on Supabase phone auth or an SMS provider.
 */
export async function createEmployee(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const parsed = employeeFormSchema.safeParse({
    fullName: text(formData, 'fullName'),
    phone: text(formData, 'phone'),
    monthlySalary: text(formData, 'monthlySalary'),
    joinedAt: text(formData, 'joinedAt'),
  })
  if (!parsed.success) return actionError('Check the details and try again.', fieldErrors(parsed.error))

  const credentials = updatePasswordSchema.safeParse({
    password: text(formData, 'password'),
    confirmPassword: text(formData, 'confirmPassword'),
  })
  if (!credentials.success) {
    return actionError('Set a password the employee can remember.', fieldErrors(credentials.error))
  }

  const admin = createAdminClient()

  // Checked before the login exists, so a duplicate number never produces an
  // orphaned Auth user. The database refuses a second profile with this number
  // too; this is the early, clearer answer.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('phone', parsed.data.phone)
    .maybeSingle()

  if (existing) {
    return actionError('That mobile number already has a login in this shop.')
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: newInternalEmployeeEmail(),
    password: credentials.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  })

  if (createError || !created.user) {
    return actionError(humanizeDatabaseError(createError?.message ?? 'Could not create the login.'))
  }

  const supabase = await createClient()
  const { error: recordError } = await supabase.rpc('create_employee_record', {
    p_user_id: created.user.id,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_monthly_salary: toSalaryNumber(parsed.data.monthlySalary),
    p_joined_at: parsed.data.joinedAt,
  })

  if (recordError) {
    // Never leave an orphaned login behind.
    await admin.auth.admin.deleteUser(created.user.id)
    return actionError(humanizeDatabaseError(recordError.message))
  }

  revalidatePath('/owner/employees')
  revalidatePath('/owner/salary')

  return actionSuccess(
    `${parsed.data.fullName} added. Share the password you just set — it is never stored or shown again, and they can change it after signing in.`,
  )
}

export async function updateEmployee(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()
  const employeeId = text(formData, 'employeeId')
  if (!employeeId) return actionError('Employee not found.')

  const name = text(formData, 'fullName')
  const phone = text(formData, 'phone')
  const salary = text(formData, 'monthlySalary')
  const joinedAt = text(formData, 'joinedAt')

  const parsed = employeeFormSchema.safeParse({
    fullName: name,
    phone,
    monthlySalary: salary,
    joinedAt,
  })
  if (!parsed.success) return actionError('Check the details and try again.', fieldErrors(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_employee_record', {
    p_employee_id: employeeId,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_monthly_salary: toSalaryNumber(parsed.data.monthlySalary),
    p_joined_at: parsed.data.joinedAt,
  })

  if (error) return actionError(humanizeDatabaseError(error.message))

  // Nothing to do in Supabase Auth: the login is an internal address that has
  // nothing to do with the number, so correcting the number here is enough for
  // the employee to sign in with the new one.
  revalidatePath(`/owner/employees/${employeeId}`)
  revalidatePath('/owner/employees')

  return actionSuccess('Employee details saved.')
}

/** Enables or disables an employee, and their login at the same time. */
export async function setEmployeeActive(formData: FormData): Promise<void> {
  await requireOwner()

  const employeeId = text(formData, 'employeeId')
  const isActive = text(formData, 'isActive') === 'true'
  if (!employeeId) return

  const supabase = await createClient()
  const { data: employee } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .maybeSingle()

  await supabase.rpc('set_employee_active', { p_employee_id: employeeId, p_is_active: isActive })

  if (employee) {
    const admin = createAdminClient()
    await admin.auth.admin.updateUserById(employee.user_id, {
      // The ban stops Auth from minting any new token for this login. Sessions
      // already in the wild are refused by the `is_active` checks on every
      // request, which is the part that has to work the instant the owner
      // clicks Disable.
      ban_duration: isActive ? 'none' : BAN_DURATION,
    })
  }

  revalidatePath(`/owner/employees/${employeeId}`)
  revalidatePath('/owner/employees')
  revalidatePath('/owner/salary')
}

/**
 * Sets a new password for an employee who has forgotten it.
 *
 * The owner types the new password here; nothing is generated and nothing is
 * returned to the browser, so the value never travels anywhere except into
 * Supabase Auth.
 */
export async function resetEmployeePassword(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const employeeId = text(formData, 'employeeId')
  if (!employeeId) return actionError('Employee not found.')

  const credentials = updatePasswordSchema.safeParse({
    password: text(formData, 'password'),
    confirmPassword: text(formData, 'confirmPassword'),
  })
  if (!credentials.success) {
    return actionError('Set a password the employee can remember.', fieldErrors(credentials.error))
  }

  const supabase = await createClient()
  const { data: employee } = await supabase
    .from('employees')
    .select('user_id')
    .eq('id', employeeId)
    .maybeSingle()

  if (!employee) return actionError('Employee not found.')

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(employee.user_id, {
    password: credentials.data.password,
  })
  if (error) return actionError(humanizeDatabaseError(error.message))

  // Changing a password does not end existing sessions on its own: the access
  // token in the cookie stays valid and a refresh token taken beforehand still
  // works. Mark the moment sessions became invalid so every app request refuses
  // them (see 00700), and revoke the refresh tokens at Auth as well.
  const { error: stampError } = await admin
    .from('profiles')
    .update({ session_invalid_before: new Date().toISOString() })
    .eq('id', employee.user_id)

  if (stampError) {
    // The new password is already saved, so say what is actually true.
    return actionError(
      'The new password is saved, but the old sessions could not be ended. Ask the employee to sign out and back in.',
    )
  }

  await admin.auth.admin.signOut(employee.user_id, 'global')

  revalidatePath(`/owner/employees/${employeeId}`)

  return actionSuccess('Password updated. They have been signed out of every device — share the new password with them.')
}

export async function recordSalaryPayment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const parsed = salaryPaymentSchema.safeParse({
    amount: text(formData, 'amount'),
    paymentDate: text(formData, 'paymentDate'),
    note: text(formData, 'note'),
  })
  if (!parsed.success) return actionError('Check the payment details.', fieldErrors(parsed.error))

  const supabase = await createClient()
  const { error } = await supabase.rpc('record_salary_payment', {
    p_employee_id: text(formData, 'employeeId'),
    p_amount: toSalaryNumber(parsed.data.amount),
    p_payment_date: parsed.data.paymentDate,
    p_note: parsed.data.note || null,
    p_idempotency_key: text(formData, 'idempotencyKey') || null,
  })

  if (error) return actionError(humanizeDatabaseError(error.message))

  revalidatePath('/owner/salary')

  return actionSuccess('Salary payment recorded. The employee has been notified.')
}

export async function cancelSalaryPayment(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const paymentId = text(formData, 'paymentId')
  if (!paymentId) return actionError('This payment could not be found.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_salary_payment', {
    p_payment_id: paymentId,
    p_note: text(formData, 'note') || null,
  })

  if (error) return actionError(humanizeDatabaseError(error.message))

  revalidatePath('/owner/salary')

  return actionSuccess('Payment cancelled.')
}

/**
 * Marks a bill as voided on purpose: the copy a customer already has stays what
 * it is, but every total and every report stops counting it from this moment.
 *
 * Only the owner can do this, the reason is mandatory (nothing accidental), the
 * row and its lines are never deleted, and a voided bill cannot be voided
 * twice. See migration 00900 for the database side.
 */
export async function voidBill(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const billId = text(formData, 'billId')
  const reason = text(formData, 'reason')
  if (!billId) return actionError('This bill could not be found.')
  if (reason.length < 3 || reason.length > 240) {
    return actionError('Enter a short reason for voiding this bill.')
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('void_bill', {
    p_bill_id: billId,
    p_reason: reason,
  })

  if (error) return actionError(humanizeDatabaseError(error.message))

  revalidatePath('/owner/bills')
  revalidatePath(`/owner/bills/${billId}`)
  revalidatePath('/owner/reports')
  revalidatePath('/owner')

  return actionSuccess('Bill voided. It no longer counts in sales totals, but the record stays for the books.')
}

export async function updateBusinessName(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOwner()

  const name = text(formData, 'name')
  if (name.length < 2 || name.length > 80) return actionError('Enter a shop name between 2 and 80 characters.')

  const supabase = await createClient()
  const { error } = await supabase.rpc('update_business', { p_name: name })
  if (error) return actionError(humanizeDatabaseError(error.message))

  revalidatePath('/', 'layout')

  return actionSuccess('Shop name updated.')
}