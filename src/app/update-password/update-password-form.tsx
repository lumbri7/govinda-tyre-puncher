'use client'

import { useActionState } from 'react'

import { updatePassword } from '@/app/(auth)/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

export function UpdatePasswordForm() {
  const [state, action] = useActionState(updatePassword, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.status === 'error' ? state.message : undefined} />

      <Field
        label="New password"
        htmlFor="new-password"
        error={state.errors?.password}
        hint="At least 8 characters."
      >
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <Field label="Confirm new password" htmlFor="confirm-password" error={state.errors?.confirmPassword}>
        <Input
          id="confirm-password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.confirmPassword)}
        />
      </Field>

      <SubmitButton pendingLabel="Saving...">Save new password</SubmitButton>
    </form>
  )
}