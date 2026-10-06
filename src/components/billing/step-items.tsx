'use client'

import { LineEditor, QuickPick } from '@/components/billing/line-editor'
import { Button, EmptyState } from '@/components/ui'
import { PARTS, SERVICES, type CatalogItem } from '@/lib/catalog'
import {
  itemTotalPaise,
  newBlankItem,
  newItem,
  type BillDraft,
  type DraftItem,
  type DraftItemType,
} from '@/lib/bill-draft'
import { formatRupees } from '@/lib/money'

export function StepItems({
  draft,
  itemType,
  catalog,
  allowTypePicker = false,
  onChange,
}: {
  draft: BillDraft
  itemType: DraftItemType
  catalog: CatalogItem[]
  allowTypePicker?: boolean
  onChange: (patch: Partial<BillDraft>) => void
}) {
  const items = draft.items.filter((item) => item.itemType === itemType)
  const titles: Record<DraftItemType, { title: string; hint: string }> = {
    service: { title: 'Services done', hint: 'Tap what you did. Prices can be changed.' },
    part: { title: 'Parts used', hint: 'Tap the parts fitted on this vehicle.' },
    custom: { title: 'Custom items', hint: 'Anything that is not a service or a part.' },
  }

  function addFromCatalog(seed: CatalogItem) {
    const existing = items.find((item) => item.name === seed.name)
    if (existing) {
      onChange({
        items: draft.items.map((item) =>
          item.key === existing.key
            ? { ...item, quantityCenti: Math.min(999_900, item.quantityCenti + 100) }
            : item,
        ),
      })
      return
    }
    onChange({ items: [...draft.items, newItem(itemType, seed)] })
  }

  function addBlank() {
    onChange({ items: [...draft.items, newBlankItem(itemType)] })
  }

  function patchItem(key: string, patch: Partial<DraftItem>) {
    onChange({ items: draft.items.map((item) => (item.key === key ? { ...item, ...patch } : item)) })
  }

  function removeItem(key: string) {
    onChange({ items: draft.items.filter((item) => item.key !== key) })
  }

  const stepTotal = items.reduce((sum, item) => sum + itemTotalPaise(item), 0)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink-950">{titles[itemType].title}</h2>
        <p className="text-sm text-ink-500">{titles[itemType].hint}</p>
      </div>

      {catalog.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {catalog.map((seed) => (
            <QuickPick
              key={seed.name}
              label={seed.name}
              pricePaise={seed.pricePaise}
              added={items.some((item) => item.name === seed.name)}
              onClick={() => addFromCatalog(seed)}
            />
          ))}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-wide text-ink-500 uppercase">On this bill</h3>
          {items.length > 0 ? (
            <span className="tabular text-sm font-bold text-ink-900">
              {formatRupees(stepTotal)}
            </span>
          ) : null}
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nothing added yet" description="Tap an item above, or add your own." />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <LineEditor
                key={item.key}
                name={item.name}
                itemType={item.itemType}
                quantityCenti={item.quantityCenti}
                unitPricePaise={item.unitPricePaise}
                lineTotalPaise={itemTotalPaise(item)}
                showTypePicker={allowTypePicker}
                types={
                  allowTypePicker
                    ? [
                        { value: 'service' as const, label: 'Service' },
                        { value: 'part' as const, label: 'Part' },
                        { value: 'custom' as const, label: 'Custom' },
                      ]
                    : undefined
                }
                onChange={(patch) => patchItem(item.key, patch)}
                onRemove={() => removeItem(item.key)}
              />
            ))}
          </ul>
        )}

        <Button variant="secondary" size="md" full className="mt-3" onClick={addBlank}>
          + Add {itemType === 'part' ? 'a part' : itemType === 'service' ? 'a service' : 'an item'}
        </Button>
      </div>
    </div>
  )
}

export const SERVICE_CATALOG = SERVICES
export const PARTS_CATALOG = PARTS