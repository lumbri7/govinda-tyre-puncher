'use client'

import { SERVICE_CHARGE_PRESETS } from '@/lib/catalog'
import { cx } from '@/components/ui'
import { formatRupees } from '@/lib/money'
import { PriceInput } from '@/components/billing/line-editor'
import type { BillDraft } from '@/lib/bill-draft'

/**
 * The quick service charge. It is stored apart from the item list and sent as
 * its own service line, so it can never be added on top of a service total by
 * mistake.
 */
export function StepCharge({
  draft,
  onChange,
}: {
  draft: BillDraft
  onChange: (patch: Partial<BillDraft>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-950">Service charge</h2>
        <p className="text-sm text-ink-500">
          The visit or labour charge for this job. Leave it at zero if there is none.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        {SERVICE_CHARGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange({ serviceChargePaise: preset })}
            aria-pressed={draft.serviceChargePaise === preset}
            className={cx(
              'min-h-16 rounded-xl text-base font-bold shadow-sm ring-1 transition-colors',
              draft.serviceChargePaise === preset
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-ink-800 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {preset === 0 ? 'None' : formatRupees(preset)}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="service-charge" className="mb-1.5 block text-sm font-semibold text-ink-700">
          Charge amount
        </label>
        <PriceInput
          id="service-charge"
          paise={draft.serviceChargePaise}
          onChange={(serviceChargePaise) => onChange({ serviceChargePaise })}
          className="min-h-16 text-lg"
        />
      </div>
    </div>
  )
}