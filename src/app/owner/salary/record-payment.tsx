'use client'

import { useActionState, useRef, useState } from 'react'

import { recordSalaryPayment } from '@/app/owner/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { Button } from '@/components/ui'
import { idleState } from '@/lib/action-state'
import { formatPaise, formatRupees } from '@/lib/money'
import { todayISO } from '@/lib/dates'

/** Collapsed to a single button, expanded into a small form. */
export function RecordPaymentButton({
  employeeId,
  employeeName,
  remainingPaise,
}: {
  employeeId: string
  employeeName: string
  remainingPaise: number
}) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={remainingPaise <= 0}
        title={remainingPaise <= 0 ? 'This month is already fully paid' : undefined}
      >
        {remainingPaise > 0 ? 'Record payment' : 'Fully paid'}
      </Button>
    )
  }

  return (
    <RecordPaymentForm
      employeeId={employeeId}
      employeeName={employeeName}
      remainingPaise={remainingPaise}
      onClose={() => setOpen(false)}
    />
  )
}

/**
 * The payment form is a separate component on purpose: it owns the action
 * state, and it is thrown away when the row collapses again. Keeping the form
 * mounted would leave the last result on screen, so the next payment would start
 * with "recorded" already written above it.
 */
function RecordPaymentForm({
  employeeId,
  employeeName,
  remainingPaise,
  onClose,
}: {
  employeeId: string
  employeeName: string
  remainingPaise: number
  onClose: () => void
}) {
  const [state, action, pending] = useActionState(recordSalaryPayment, idleState)
  const done = state.status === 'success'
  // One key per payment form, so a retry of a slow network write returns the
  // payment that was already recorded instead of recording the money twice.
  // Written at submit time so it is never re-rendered.
  const idempotencyKeyRef = useRef<string | null>(null)
  const idempotencyKeyFieldRef = useRef<HTMLInputElement>(null)

  return (
    <form
      action={action}
      onSubmit={() => {
        if (!idempotencyKeyRef.current) idempotencyKeyRef.current = crypto.randomUUID()
        if (idempotencyKeyFieldRef.current) {
          idempotencyKeyFieldRef.current.value = idempotencyKeyRef.current
        }
      }}
      className="space-y-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200"
    >
      <input type="hidden" name="employeeId" value={employeeId} />
      <input ref={idempotencyKeyFieldRef} type="hidden" name="idempotencyKey" />
      <p className="text-sm font-semibold text-ink-900">Record payment for {employeeName}</p>

      <FormMessage
        error={state.status === 'error' ? state.message : undefined}
        success={done ? state.message : undefined}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Amount" htmlFor={`amount-${employeeId}`} error={state.errors?.amount}>
          <Input
            id={`amount-${employeeId}`}
            name="amount"
            inputMode="decimal"
            className="tabular"
            defaultValue={remainingPaise > 0 ? formatPaise(remainingPaise) : ''}
            required
          />
        </Field>
        <Field label="Date" htmlFor={`date-${employeeId}`} error={state.errors?.paymentDate}>
          <Input
            id={`date-${employeeId}`}
            name="paymentDate"
            type="date"
            defaultValue={todayISO()}
            max={todayISO()}
            required
          />
        </Field>
        <Field label="Note (optional)" htmlFor={`note-${employeeId}`} error={state.errors?.note}>
          <Input id={`note-${employeeId}`} name="note" maxLength={200} placeholder="Diwali bonus" />
        </Field>
      </div>

      <p className="text-xs text-ink-500">
        Remaining for this month: {formatRupees(remainingPaise)}. The employee must accept it before it
        counts as paid.
      </p>

      {/* After a successful payment the confirmation above is the answer: saving
          again would record the same money twice. */}
      <div className="flex gap-2">
        <SubmitButton size="md" pendingLabel="Saving..." disabled={done}>
          Save payment
        </SubmitButton>
        <Button size="md" variant="ghost" onClick={onClose}>
          {done ? 'Close' : 'Cancel'}
        </Button>
      </div>
      {pending ? <span className="sr-only">Saving the payment</span> : null}
    </form>
  )
}