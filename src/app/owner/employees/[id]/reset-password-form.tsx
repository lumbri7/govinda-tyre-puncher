'use client'

import { useActionState } from 'react'

import { resetEmployeePassword } from '@/app/owner/actions'
import { FormMessage } from '@/components/form'
import { PasswordField } from '@/components/password-field'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

/**
 * Owner-set password reset. The owner types the new password twice here: the
 * shop has no SMS provider, so there is no one-time code to send and no
 * generated password to read out.
 */
export function ResetPasswordForm({ employeeId }: { employeeId: string }) {
  const [state, action] = useActionState(resetEmployeePassword, idleState)

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />

      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />

      <PasswordField
        id="reset-password"
        name="password"
        label="New password"
        error={state.errors?.password}
        hint="At least 8 characters, with a letter and a number."
      />

      <PasswordField
        id="reset-confirm-password"
        name="confirmPassword"
        label="Confirm new password"
        error={state.errors?.confirmPassword}
      />

      <SubmitButton variant="secondary" pendingLabel="Saving...">
        Save new password
      </SubmitButton>

      <p className="text-xs text-ink-500">
        This signs the employee out of every device. Share the new password with them in person — it
        is never stored by the app or shown again.
      </p>
    </form>
  )
}