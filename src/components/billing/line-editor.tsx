'use client'

import { useId } from 'react'

import { Field, Input } from '@/components/form'
import { Button, cx } from '@/components/ui'
import { formatQuantity, formatRupees } from '@/lib/money'

/** One editable line of a bill. */
export function LineEditor({
  name,
  quantityCenti,
  unitPricePaise,
  lineTotalPaise,
  showTypePicker,
  types,
  itemType,
  onChange,
  onRemove,
}: {
  name: string
  quantityCenti: number
  unitPricePaise: number
  lineTotalPaise: number
  showTypePicker?: boolean
  types?: { value: 'service' | 'part' | 'custom'; label: string }[]
  itemType: 'service' | 'part' | 'custom'
  onChange: (patch: { name?: string; quantityCenti?: number; unitPricePaise?: number; itemType?: 'service' | 'part' | 'custom' }) => void
  onRemove: () => void
}) {
  const id = useId()
  const whole = Math.floor(quantityCenti / 100)
  const hasFraction = quantityCenti % 100 !== 0

  return (
    <li className="space-y-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-200/70">
      <div className="flex items-start gap-2">
        <Field label="Item" htmlFor={`${id}-name`} className="min-w-0 flex-1">
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Item name"
            maxLength={60}
          />
        </Field>
        <Button variant="ghost" size="md" onClick={onRemove} aria-label={`Remove ${name || 'item'}`}>
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </Button>
      </div>

      <div className="flex items-end gap-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-500">Qty</p>
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="md"
              aria-label="Decrease quantity"
              onClick={() => onChange({ quantityCenti: Math.max(1, quantityCenti - 100) })}
            >
              −
            </Button>
            <span className="tabular w-12 text-center text-base font-semibold">
              {formatQuantity(quantityCenti)}
            </span>
            <Button
              variant="secondary"
              size="md"
              aria-label="Increase quantity"
              onClick={() => onChange({ quantityCenti: Math.min(999_900, quantityCenti + 100) })}
            >
              +
            </Button>
          </div>
        </div>

        <Field label="Price" htmlFor={`${id}-price`} className="min-w-0 flex-1">
          <PriceInput
            id={`${id}-price`}
            paise={unitPricePaise}
            onChange={(unitPricePaise) => onChange({ unitPricePaise })}
          />
        </Field>

        <div className="text-right">
          <p className="mb-1 text-xs font-semibold text-ink-500">Total</p>
          <p className="tabular min-h-12 text-base font-bold text-ink-950 sm:py-3.5">
            {formatRupees(lineTotalPaise)}
          </p>
        </div>
      </div>

      {hasFraction ? (
        <p className="text-xs text-ink-500">
          Quantity {formatQuantity(quantityCenti)} ({whole} and a part)
        </p>
      ) : null}

      {showTypePicker && types ? (
        <div className="flex flex-wrap gap-1.5">
          {types.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ itemType: option.value })}
              className={cx(
                'min-h-9 rounded-lg px-3 text-xs font-semibold',
                itemType === option.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-ink-100 text-ink-700 hover:bg-ink-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </li>
  )
}

/** Price field that shows the stored value and re-parses whatever is typed. */
export function PriceInput({
  id,
  paise,
  onChange,
  className,
}: {
  id: string
  paise: number
  onChange: (paise: number) => void
  className?: string
}) {
  return (
    <Input
      id={id}
      inputMode="decimal"
      className={cx('tabular text-right', className)}
      value={paise === 0 ? '' : (paise / 100).toFixed(2)}
      placeholder="0.00"
      onChange={(event) => {
        const parsed = Number(event.target.value.replace(/[^\d.]/g, ''))
        onChange(Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0)
      }}
    />
  )
}

/** Large tap target that adds a catalog item to the bill. */
export function QuickPick({
  label,
  pricePaise,
  added,
  onClick,
}: {
  label: string
  pricePaise: number
  added: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={added}
      className={cx(
        'flex min-h-14 w-full items-center justify-between gap-2 rounded-xl px-3.5 text-left text-sm font-semibold shadow-sm ring-1 transition-colors',
        added ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-ink-800 ring-ink-200 hover:bg-ink-50',
      )}
    >
      <span className="truncate">{label}</span>
      <span className={cx('tabular shrink-0 text-xs', added ? 'text-brand-100' : 'text-ink-500')}>
        {formatRupees(pricePaise)}
      </span>
    </button>
  )
}