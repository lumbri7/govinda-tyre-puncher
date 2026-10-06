import type { VehicleType } from '@/components/billing/types'
import { SERVICE_CHARGE_NAME, type CatalogItem } from '@/lib/catalog'
import { lineTotalPaise } from '@/lib/money'
import type { BillItemInput } from '@/lib/validation'

export type DraftItemType = 'service' | 'part' | 'custom'

export type DraftItem = {
  key: string
  itemType: DraftItemType
  name: string
  /** Quantity in hundredths: 100 means 1, 150 means 1.5 (litres of oil). */
  quantityCenti: number
  unitPricePaise: number
}

export type BillDraft = {
  vehicleType: VehicleType | null
  vehicleNumber: string
  /** What the vehicle actually is, when `vehicleType` is `other`. */
  vehicleDescription: string
  customerName: string
  customerPhone: string
  /** Quick service charge. Kept apart so it can never be counted twice. */
  serviceChargePaise: number
  items: DraftItem[]
}

export const STEPS = [
  { key: 'vehicle', title: 'Vehicle', hint: 'What came in?' },
  { key: 'details', title: 'Customer', hint: 'Who is it for?' },
  { key: 'charge', title: 'Service charge', hint: 'Labour / visit charge' },
  { key: 'services', title: 'Services', hint: 'Puncture, patching…' },
  { key: 'parts', title: 'Parts', hint: 'Tube, tyre, valve…' },
  { key: 'custom', title: 'Custom items', hint: 'Anything else' },
  { key: 'review', title: 'Review', hint: 'Check and save' },
] as const

export type StepKey = (typeof STEPS)[number]['key']

export function emptyDraft(): BillDraft {
  return {
    vehicleType: null,
    vehicleNumber: '',
    vehicleDescription: '',
    customerName: '',
    customerPhone: '',
    serviceChargePaise: 0,
    items: [],
  }
}

let keyCounter = 0

export function newItem(itemType: DraftItemType, seed: CatalogItem): DraftItem {
  keyCounter += 1
  return {
    key: `item-${keyCounter}`,
    itemType,
    name: seed.name,
    quantityCenti: 100,
    unitPricePaise: seed.pricePaise,
  }
}

export function newBlankItem(itemType: DraftItemType): DraftItem {
  keyCounter += 1
  return { key: `item-${keyCounter}`, itemType, name: '', quantityCenti: 100, unitPricePaise: 0 }
}

/** Service charge as a real service line, appended last so the receipt reads well. */
export function serviceChargeItem(paise: number): DraftItem | null {
  if (paise <= 0) return null
  keyCounter += 1
  return {
    key: `item-${keyCounter}`,
    itemType: 'service',
    name: SERVICE_CHARGE_NAME,
    quantityCenti: 100,
    unitPricePaise: paise,
  }
}

export function itemTotalPaise(item: DraftItem): number {
  return lineTotalPaise(item.quantityCenti, item.unitPricePaise)
}

export function totalsOf(draft: BillDraft) {
  const charge = serviceChargeItem(draft.serviceChargePaise)
  const servicePaise = sumBy(draft.items, 'service', charge)
  const partsPaise = sumBy(draft.items, 'part', charge)
  const customPaise = sumBy(draft.items, 'custom', charge)

  return {
    servicePaise,
    partsPaise,
    customPaise,
    grandPaise: servicePaise + partsPaise + customPaise,
  }
}

function sumBy(items: DraftItem[], type: DraftItemType, charge: DraftItem | null): number {
  const itemSum = items
    .filter((item) => item.itemType === type && item.name.trim() !== '')
    .reduce((sum, item) => sum + itemTotalPaise(item), 0)

  if (type === 'service' && charge) return itemSum + itemTotalPaise(charge)
  return itemSum
}

/** Everything that will be sent to `create_bill`, in receipt order. */
export function toBillItems(draft: BillDraft): BillItemInput[] {
  const items = draft.items
    .filter((item) => item.name.trim() !== '' && item.quantityCenti > 0)
    .map((item) => ({
      itemType: item.itemType,
      name: item.name.trim(),
      quantityCenti: item.quantityCenti,
      unitPricePaise: item.unitPricePaise,
    }))

  const charge = serviceChargeItem(draft.serviceChargePaise)
  if (charge) {
    items.push({
      itemType: 'service',
      name: charge.name,
      quantityCenti: charge.quantityCenti,
      unitPricePaise: charge.unitPricePaise,
    })
  }

  return items
}

export function countItems(draft: BillDraft): number {
  return toBillItems(draft).length
}