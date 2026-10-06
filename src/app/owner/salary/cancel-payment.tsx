'use client'

import { useActionState } from 'react'

import { cancelSalaryPayment } from '@/app/owner/actions'
import { FormMessage } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { idleState } from '@/lib/action-state'

/** Cancelling a pending payment, with the reason recorded against it. */
export function CancelPaymentForm({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(cancelSalaryPayment, idleState)

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="note" value="Cancelled by owner" />
      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={state.status === 'success' ? state.message : undefined}
      />
      <SubmitButton size="sm" variant="danger" pendingLabel="Cancelling..." disabled={pending}>
        Cancel
      </SubmitButton>
    </form>
  )
}