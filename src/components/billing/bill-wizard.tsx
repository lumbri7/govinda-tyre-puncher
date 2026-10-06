'use client'

import { useActionState, useMemo, useState } from 'react'

import { StepCharge } from '@/components/billing/step-charge'
import { StepDetails } from '@/components/billing/step-details'
import { StepItems } from '@/components/billing/step-items'
import { StepReview } from '@/components/billing/step-review'
import { StepVehicle } from '@/components/billing/step-vehicle'
import { Button, cx } from '@/components/ui'
import { FormMessage } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import type { ActionState } from '@/lib/action-state'
import { idleState } from '@/lib/action-state'
import { PARTS, SERVICES } from '@/lib/catalog'
import {
  STEPS,
  emptyDraft,
  toBillItems,
  totalsOf,
  type BillDraft,
  type StepKey,
} from '@/lib/bill-draft'
import { formatRupees } from '@/lib/money'
import { toRpcItems } from '@/lib/validation'

const LAST_STEP = STEPS.length - 1

export function BillWizard({
  submitAction,
  pendingLabel = 'Saving bill...',
}: {
  submitAction: (state: ActionState, formData: FormData) => Promise<ActionState>
  pendingLabel?: string
}) {
  const [state, formAction] = useActionState(submitAction, idleState)
  const [stepIndex, setStepIndex] = useState(0)
  const [draft, setDraft] = useState<BillDraft>(emptyDraft)
  const [showErrors, setShowErrors] = useState(false)

  const step = STEPS[stepIndex]
  const totals = useMemo(() => totalsOf(draft), [draft])
  const itemCount = useMemo(() => toBillItems(draft).length, [draft])

  const errors = showErrors ? localErrors(step.key, draft) : {}
  // Shown as soon as the review is reached: an empty bill can never be saved.
  const reviewError =
    step.key === 'review'
      ? itemCount === 0
        ? 'Add at least one item to the bill.'
        : state.status === 'error'
          ? state.message
          : undefined
      : undefined

  function update(patch: Partial<BillDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function goTo(index: number) {
    if (index < 0 || index >= STEPS.length || index > stepIndex) return
    setShowErrors(false)
    setStepIndex(index)
  }

  function goNext() {
    if (step.key === 'review') return
    if (localError(step.key, draft)) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    setStepIndex((index) => Math.min(index + 1, LAST_STEP))
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        // Enter on a keyboard should walk through the steps, not save early.
        if (step.key !== 'review') event.preventDefault()
      }}
      className="space-y-4"
    >
      <input type="hidden" name="customerName" value={draft.customerName} />
      <input type="hidden" name="customerPhone" value={draft.customerPhone} />
      <input type="hidden" name="vehicleType" value={draft.vehicleType ?? ''} />
      <input type="hidden" name="vehicleNumber" value={draft.vehicleNumber} />
      <input type="hidden" name="vehicleDescription" value={draft.vehicleDescription} />
      <input type="hidden" name="items" value={JSON.stringify(toRpcItems(toBillItems(draft)))} />

      <div className="flex items-center gap-2">
        <ol className="flex flex-1 gap-1" aria-label="Bill steps">
          {STEPS.map((entry, index) => (
            <li key={entry.key} className="flex-1">
              <button
                type="button"
                onClick={() => goTo(index)}
                disabled={index > stepIndex}
                aria-current={index === stepIndex ? 'step' : undefined}
                title={entry.title}
                className={cx(
                  'h-1.5 w-full rounded-full transition-colors',
                  index < stepIndex
                    ? 'bg-brand-400 hover:bg-brand-500'
                    : index === stepIndex
                      ? 'bg-brand-600'
                      : 'bg-ink-200',
                )}
              >
                <span className="sr-only">
                  Step {index + 1}: {entry.title}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <p className="tabular shrink-0 text-sm font-bold text-ink-900">
          {formatRupees(totals.grandPaise)}
        </p>
      </div>

      <div className="flex items-baseline justify-between">
        <h1 className="text-base font-bold text-ink-950">
          {step.title}
          <span className="ml-2 text-xs font-medium text-ink-400">
            step {stepIndex + 1} of {STEPS.length}
          </span>
        </h1>
      </div>

      {state.status === 'error' && step.key !== 'review' ? (
        <FormMessage error={state.message} />
      ) : null}

      <div className="rounded-2xl">
        {step.key === 'vehicle' ? (
          <StepVehicle
            draft={draft}
            error={errors.vehicleNumber}
            descriptionError={errors.vehicleDescription}
            onChange={update}
          />
        ) : null}
        {step.key === 'details' ? <StepDetails draft={draft} errors={errors} onChange={update} /> : null}
        {step.key === 'charge' ? <StepCharge draft={draft} onChange={update} /> : null}
        {step.key === 'services' ? (
          <StepItems draft={draft} itemType="service" catalog={SERVICES} onChange={update} />
        ) : null}
        {step.key === 'parts' ? (
          <StepItems draft={draft} itemType="part" catalog={PARTS} onChange={update} />
        ) : null}
        {step.key === 'custom' ? (
          <StepItems
            draft={draft}
            itemType="custom"
            catalog={[]}
            allowTypePicker
            onChange={update}
          />
        ) : null}
        {step.key === 'review' ? (
          <StepReview
            draft={draft}
            totals={totals}
            onEditStep={goTo}
            error={reviewError}
            submitButton={
              <SubmitButton
                pendingLabel={pendingLabel}
                size="lg"
                className="text-lg"
                disabled={itemCount === 0}
              >
                Save bill · {formatRupees(totals.grandPaise)}
              </SubmitButton>
            }
          />
        ) : null}
      </div>

      <div className="flex gap-2.5">
        {stepIndex > 0 ? (
          <Button variant="secondary" onClick={() => goTo(stepIndex - 1)} className="shrink-0">
            Back
          </Button>
        ) : null}
        {step.key !== 'review' ? (
          <Button onClick={goNext} className="flex-1">
            {itemCount === 0 && stepIndex >= 3 ? 'Skip' : 'Next'}
          </Button>
        ) : null}
      </div>
    </form>
  )
}

type StepProblem = { field: string; message: string }

function localErrors(step: StepKey, draft: BillDraft): Record<string, string> {
  const problem = localError(step, draft)
  if (!problem) return {}
  return { [problem.field]: problem.message }
}

/** The first thing missing on this step, and which input to point at. */
function localError(step: StepKey, draft: BillDraft): StepProblem | undefined {
  switch (step) {
    case 'vehicle':
      if (!draft.vehicleType) return { field: 'vehicleNumber', message: 'Choose the vehicle type.' }
      if (draft.vehicleNumber.trim().length < 4) {
        return { field: 'vehicleNumber', message: 'Enter the vehicle number.' }
      }
      if (draft.vehicleType === 'other' && draft.vehicleDescription.trim().length === 0) {
        return { field: 'vehicleDescription', message: 'Describe the vehicle.' }
      }
      return undefined
    case 'details':
      if (draft.customerName.trim().length === 0) {
        return { field: 'customerName', message: 'Enter the customer name.' }
      }
      return undefined
    case 'review':
      if (toBillItems(draft).length === 0) {
        return { field: 'items', message: 'Add at least one item to the bill.' }
      }
      return undefined
    default:
      return undefined
  }
}