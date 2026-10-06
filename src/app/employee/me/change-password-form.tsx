'use client'

import { useActionState } from 'react'

import { changeOwnPassword } from '@/app/shared-actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />

      <Field
        label="New password"
        htmlFor="me-password"
        error={state.errors?.password}
        hint="At least 8 characters."
      >
        <Input id="me-password" name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm new password" htmlFor="me-confirm" error={state.errors?.confirmPassword}>
        <Input
          id="me-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <SubmitButton pendingLabel="Saving...">Save password</SubmitButton>
    </form>
  )
}