'use client'

import { useActionState } from 'react'

import { updateBusinessName } from '@/app/owner/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

export function ShopNameForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateBusinessName, idleState)

  return (
    <form action={action} className="space-y-3">
      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />

      <Field label="Shop name (printed on every bill)" htmlFor="shop-name">
        <Input id="shop-name" name="name" defaultValue={name} maxLength={80} required />
      </Field>

      <SubmitButton size="md" pendingLabel="Saving...">
        Save shop name
      </SubmitButton>
    </form>
  )
}