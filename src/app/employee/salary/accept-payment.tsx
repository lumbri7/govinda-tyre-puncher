'use client'

import { useActionState } from 'react'

import { acceptSalaryPayment } from '@/app/employee/actions'
import { FormMessage } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

/**
 * Accepting a payment is the employee saying "this money reached me", so a
 * failed request has to say so. The server action reports its own errors; this
 * only has to show them and keep the button busy while they run.
 */
export function AcceptPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(acceptSalaryPayment, idleState)

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />
      <SubmitButton size="md" variant="success" pendingLabel="Accepting..." disabled={pending}>
        Accept
      </SubmitButton>
    </form>
  )
}