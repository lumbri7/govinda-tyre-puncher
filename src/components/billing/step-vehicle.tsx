'use client'

import { VEHICLE_TYPES } from '@/lib/catalog'
import { cx } from '@/components/ui'
import { normalizeVehicleNumber } from '@/lib/validation'
import type { BillDraft } from '@/lib/bill-draft'
import type { VehicleType } from '@/components/billing/types'

export function StepVehicle({
  draft,
  error,
  descriptionError,
  onChange,
}: {
  draft: BillDraft
  error?: string
  descriptionError?: string
  onChange: (patch: Partial<BillDraft>) => void
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-950">Which vehicle is in?</h2>
        <p className="text-sm text-ink-500">Tap the type, then type the number plate.</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {VEHICLE_TYPES.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ vehicleType: option.value as VehicleType })}
            aria-pressed={draft.vehicleType === option.value}
            className={cx(
              'min-h-16 rounded-xl text-base font-bold shadow-sm ring-1 transition-colors',
              draft.vehicleType === option.value
                ? 'bg-brand-600 text-white ring-brand-600'
                : 'bg-white text-ink-800 ring-ink-200 hover:bg-ink-50',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="vehicle-number" className="mb-1.5 block text-sm font-semibold text-ink-700">
          Vehicle number
        </label>
        <input
          id="vehicle-number"
          value={draft.vehicleNumber}
          onChange={(event) =>
            onChange({ vehicleNumber: normalizeVehicleNumber(event.target.value.toUpperCase()) })
          }
          placeholder="PB 12 AB 1234"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={15}
          inputMode="text"
          aria-invalid={Boolean(error)}
          className={cx(
            'min-h-16 w-full rounded-xl border-0 bg-white px-4 text-xl font-bold tracking-wider text-ink-950 uppercase shadow-sm ring-1 focus:ring-2 focus:ring-brand-600 focus:outline-none',
            error ? 'ring-bad-600' : 'ring-ink-200',
          )}
        />
        <p className={cx('mt-1.5 text-sm', error ? 'font-medium text-bad-600' : 'text-ink-500')}>
          {error ?? 'Spaces and dashes are removed automatically.'}
        </p>
      </div>

      {draft.vehicleType === 'other' ? (
        <div>
          <label
            htmlFor="vehicle-description"
            className="mb-1.5 block text-sm font-semibold text-ink-700"
          >
            What came in?
          </label>
          <input
            id="vehicle-description"
            value={draft.vehicleDescription}
            onChange={(event) => onChange({ vehicleDescription: event.target.value })}
            placeholder="Hand cart, generator, trolley…"
            maxLength={80}
            autoComplete="off"
            aria-invalid={Boolean(descriptionError)}
            className={cx(
              'min-h-16 w-full rounded-xl border-0 bg-white px-4 text-lg text-ink-950 shadow-sm ring-1 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-600 focus:outline-none',
              descriptionError ? 'ring-bad-600' : 'ring-ink-200',
            )}
          />
          <p
            className={cx(
              'mt-1.5 text-sm',
              descriptionError ? 'font-medium text-bad-600' : 'text-ink-500',
            )}
          >
            {descriptionError ?? 'Printed on the bill so nobody has to guess what it was.'}
          </p>
        </div>
      ) : null}
    </div>
  )
}