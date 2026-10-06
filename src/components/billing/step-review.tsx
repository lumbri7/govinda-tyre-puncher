'use client'

import { VEHICLE_LABELS } from '@/lib/catalog'
import { Button, Card, cx } from '@/components/ui'
import { formatQuantity, formatRupees } from '@/lib/money'
import { itemTotalPaise, type BillDraft, type DraftItemType } from '@/lib/bill-draft'

const GROUPS: { type: DraftItemType; title: string; stepIndex: number }[] = [
  { type: 'service', title: 'Services', stepIndex: 3 },
  { type: 'part', title: 'Parts', stepIndex: 4 },
  { type: 'custom', title: 'Custom items', stepIndex: 5 },
]

export function StepReview({
  draft,
  totals,
  onEditStep,
  submitButton,
  error,
}: {
  draft: BillDraft
  totals: { servicePaise: number; partsPaise: number; customPaise: number; grandPaise: number }
  onEditStep: (index: number) => void
  submitButton: React.ReactNode
  error?: string
}) {
  const itemsIn = (type: DraftItemType) => draft.items.filter((item) => item.itemType === type)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-950">Review the bill</h2>
        <p className="text-sm text-ink-500">Check the details, then save.</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink-950">{draft.customerName || '—'}</p>
            <p className="text-sm text-ink-600">
              {draft.vehicleType ? VEHICLE_LABELS[draft.vehicleType] : '—'} ·{' '}
              <span className="tabular font-semibold">{draft.vehicleNumber || '—'}</span>
            </p>
            {draft.vehicleType === 'other' && draft.vehicleDescription ? (
              <p className="truncate text-sm text-ink-500">{draft.vehicleDescription}</p>
            ) : null}
            {draft.customerPhone ? (
              <p className="tabular text-sm text-ink-500">{draft.customerPhone}</p>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" onClick={() => onEditStep(0)}>
            Edit
          </Button>
        </div>
      </Card>

      {GROUPS.map((group) => {
        const items = itemsIn(group.type)
        const isChargeGroup = group.type === 'service'

        return (
          <section key={group.type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">
                {group.title}
                {isChargeGroup && draft.serviceChargePaise > 0 ? (
                  <span className="ml-2 normal-case">incl. service charge</span>
                ) : null}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => onEditStep(group.stepIndex)}>
                Edit
              </Button>
            </div>

            {items.length === 0 && !(isChargeGroup && draft.serviceChargePaise > 0) ? (
              <p className="rounded-xl bg-white px-3 py-2.5 text-sm text-ink-400 shadow-sm ring-1 ring-ink-200/70">
                None
              </p>
            ) : (
              <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
                {items.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink-900">{item.name}</p>
                      <p className="tabular text-xs text-ink-500">
                        {formatQuantity(item.quantityCenti)} × {formatRupees(item.unitPricePaise)}
                      </p>
                    </div>
                    <p className="tabular text-sm font-bold text-ink-950">
                      {formatRupees(itemTotalPaise(item))}
                    </p>
                  </li>
                ))}
                {isChargeGroup && draft.serviceChargePaise > 0 ? (
                  <li className="flex items-center gap-3 bg-brand-50/60 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-900">Service Charge</p>
                      <p className="tabular text-xs text-brand-800">
                        1 × {formatRupees(draft.serviceChargePaise)}
                      </p>
                    </div>
                    <p className="tabular text-sm font-bold text-brand-900">
                      {formatRupees(draft.serviceChargePaise)}
                    </p>
                  </li>
                ) : null}
              </ul>
            )}
          </section>
        )
      })}

      <Card className="space-y-1.5 bg-ink-950 text-white">
        <Row label="Services" value={totals.servicePaise} />
        <Row label="Parts" value={totals.partsPaise} />
        <Row label="Custom items" value={totals.customPaise} />
        <div className="mt-2 flex items-center justify-between border-t border-white/15 pt-2.5">
          <span className="text-sm font-semibold text-white/70">Grand total</span>
          <span className="tabular text-xl font-bold">{formatRupees(totals.grandPaise)}</span>
        </div>
      </Card>

      {error ? (
        <p role="alert" className="rounded-xl bg-bad-50 px-3 py-2.5 text-sm font-medium text-bad-700">
          {error}
        </p>
      ) : null}

      {submitButton}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/70">{label}</span>
      <span className={cx('tabular font-semibold', value === 0 ? 'text-white/40' : 'text-white')}>
        {formatRupees(value)}
      </span>
    </div>
  )
}

