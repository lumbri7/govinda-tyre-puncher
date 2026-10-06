/**
 * Quick pick lists for the billing flow. Prices are only defaults: the employee
 * can change any price before saving, and the server always recalculates the
 * totals, so nothing here is trusted.
 */

export type VehicleOption = {
  value: 'bike' | 'car' | 'small_truck' | 'large_truck' | 'tractor' | 'other'
  label: string
  short: string
}

export const VEHICLE_TYPES: VehicleOption[] = [
  { value: 'bike', label: 'Bike', short: 'Bike' },
  { value: 'car', label: 'Car', short: 'Car' },
  { value: 'small_truck', label: 'Small truck', short: 'Truck' },
  { value: 'large_truck', label: 'Large truck', short: 'Hulkar' },
  { value: 'tractor', label: 'Tractor', short: 'Tractor' },
  { value: 'other', label: 'Other', short: 'Other' },
]

export const VEHICLE_LABELS: Record<VehicleOption['value'], string> = Object.fromEntries(
  VEHICLE_TYPES.map((option) => [option.value, option.label]),
) as Record<VehicleOption['value'], string>

export type CatalogItem = { name: string; pricePaise: number }

export const SERVICES: CatalogItem[] = [
  { name: 'Puncture Repair', pricePaise: 15000 },
  { name: 'Air Check', pricePaise: 5000 },
  { name: 'Tyre Repair', pricePaise: 20000 },
  { name: 'Tube Repair', pricePaise: 25000 },
  { name: 'Tyre Replacement', pricePaise: 180000 },
  { name: 'Tube Replacement', pricePaise: 22000 },
  { name: 'Wheel Balancing', pricePaise: 30000 },
  { name: 'Sidewall Repair', pricePaise: 35000 },
  { name: 'Wheel Alignment', pricePaise: 50000 },
  { name: 'Tyre Removal / Refit', pricePaise: 10000 },
  { name: 'Valve Replacement', pricePaise: 12000 },
  { name: 'Rim Inspection', pricePaise: 10000 },
]

export const PARTS: CatalogItem[] = [
  { name: 'Tube', pricePaise: 45000 },
  { name: 'Tyre', pricePaise: 180000 },
  { name: 'Puncture Material', pricePaise: 5000 },
  { name: 'Valve', pricePaise: 8000 },
  { name: 'Rim', pricePaise: 120000 },
  { name: 'Wheel Nut / Bolt', pricePaise: 3000 },
  { name: 'Air Cap', pricePaise: 4000 },
  { name: 'Bead Wire', pricePaise: 6000 },
]

/** The quick charge added as a service line so it is never counted twice. */
export const SERVICE_CHARGE_NAME = 'Service Charge'

export const SERVICE_CHARGE_PRESETS = [0, 5000, 10000, 20000, 30000]