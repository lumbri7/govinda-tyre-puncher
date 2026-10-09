'use client'

import { useActionState, useState } from 'react'

import { voidBill } from '@/app/owner/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui'
import { idleState } from '@/lib/action-state'

/**
 * The owner voids a bill in two deliberate steps: button first, then a short,
 * mandatory reason. Nothing about a void is a tap that can slip.
 */
export function VoidBillForm({
  billId,
  billNumber,
  customerName,
  grandTotal,
}: {
  billId: string
  billNumber: string
  customerName: string
  grandTotal: string
}) {
  const [state, action] = useActionState(voidBill, idleState)
  const [confirming, setConfirming] = useState(false)
  const done = state.status === 'success'

  return (
    <div className="no-print space-y-2 rounded-2xl border border-dashed border-bad-200 bg-bad-50/40 p-4">
      {done ? (
        <FormMessage success={state.message} />
      ) : confirming ? (
        <form action={action} className="space-y-3">
          <p className="text-sm font-semibold text-ink-900">
            Void {billNumber} ({customerName}, {grandTotal})?
          </p>
          <p className="text-xs text-ink-600">
            The bill is kept for the books but stops counting in every total from now on. This cannot
            be undone except by the shop&apos;s records.
          </p>

          <FormMessage error={state.status === 'error' ? state.message : undefined} />

          <input type="hidden" name="billId" value={billId} />
          <Field label="Reason" htmlFor="void-reason" error={state.errors?.reason}>
            <Input
              id="void-reason"
              name="reason"
              maxLength={240}
              placeholder="Wrong amount entered, duplicate bill…"
              required
            />
          </Field>

          <div className="flex gap-2">
            <SubmitButton variant="danger" size="md" pendingLabel="Voiding bill...">
              Void this bill
            </SubmitButton>
            <Button size="md" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Void this bill
        </Button>
      )}
    </div>
  )
}