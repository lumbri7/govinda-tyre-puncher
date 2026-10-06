'use client'

import { Field, Input } from '@/components/form'
import { normalizePhone } from '@/lib/validation'
import type { BillDraft } from '@/lib/bill-draft'

export function StepDetails({
  draft,
  errors,
  onChange,
}: {
  draft: BillDraft
  errors?: Record<string, string>
  onChange: (patch: Partial<BillDraft>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-950">Customer details</h2>
        <p className="text-sm text-ink-500">The name goes on the bill. The number is optional.</p>
      </div>

      <Field label="Customer name" htmlFor="customer-name" error={errors?.customerName}>
        <Input
          id="customer-name"
          value={draft.customerName}
          onChange={(event) => onChange({ customerName: event.target.value })}
          placeholder="Full name"
          autoComplete="name"
          maxLength={80}
          className="text-lg"
          invalid={Boolean(errors?.customerName)}
        />
      </Field>

      <Field
        label="Mobile number (optional)"
        htmlFor="customer-phone"
        error={errors?.customerPhone}
        hint="Saved on the bill so the same customer can be recognised next time."
      >
        <div className="flex">
          <span className="flex min-h-14 items-center rounded-l-xl bg-ink-100 px-3 text-sm font-semibold text-ink-600">
            +91
          </span>
          <Input
            id="customer-phone"
            value={draft.customerPhone.replace(/^\+91/, '')}
            onChange={(event) => onChange({ customerPhone: normalizePhone(event.target.value) })}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            placeholder="98765 43210"
            className="tabular rounded-l-none"
            invalid={Boolean(errors?.customerPhone)}
          />
        </div>
      </Field>
    </div>
  )
}