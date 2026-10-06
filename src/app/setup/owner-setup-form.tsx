'use client'

import { useActionState } from 'react'

import { signUpOwner } from '@/app/(auth)/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

export function OwnerSetupForm() {
  const [state, action] = useActionState(signUpOwner, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.status === 'error' ? state.message : undefined} />

      <Field label="Shop name" htmlFor="businessName" error={state.errors?.businessName}>
        <Input
          id="businessName"
          name="businessName"
          placeholder="Govinda Tyre Puncture"
          autoComplete="organization"
          required
          invalid={Boolean(state.errors?.businessName)}
        />
      </Field>

      <Field label="Your name" htmlFor="setup-fullName" error={state.errors?.fullName}>
        <Input
          id="setup-fullName"
          name="fullName"
          autoComplete="name"
          required
          invalid={Boolean(state.errors?.fullName)}
        />
      </Field>

      <Field label="Email" htmlFor="setup-email" error={state.errors?.email}>
        <Input
          id="setup-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="setup-password"
        error={state.errors?.password}
        hint="At least 8 characters, with one letter and one number."
      >
        <Input
          id="setup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton pendingLabel="Creating the shop...">Create shop and owner account</SubmitButton>
    </form>
  )
}