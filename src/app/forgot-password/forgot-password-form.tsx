'use client'

import { useActionState } from 'react'

import { requestPasswordReset } from '@/app/(auth)/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />

      <Field
        label="Email"
        htmlFor="reset-email"
        error={state.errors?.email}
        hint="Only the shop owner can reset by email. Employees should ask the owner to set a new password."
      >
        <Input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>
    </form>
  )
}