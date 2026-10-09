/**
 * Money helpers.
 *
 * Prices are entered as text on a phone keyboard and sent to Postgres as
 * `numeric(12,2)`. To keep the arithmetic exact everywhere (the database
 * rounds line totals itself) all client side money is held as integer paise,
 * so 250.50 rupees is the number 25050 and never 250.49999999.
 */

/** Largest amount the database accepts for a single line or payment. */
export const MAX_PAISES = 100_000_000_00

export function parseAmountToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null
  const raw = typeof input === 'number' ? input : input.replace(/[\s,_]/g, '').trim()
  if (raw === '' || raw === '.' || raw === '-') return null

  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value)) return null

  const negative = value < 0
  // Round to 2 decimals first so 0.1 + 0.2 style drift cannot sneak in.
  const paise = Math.round(Math.abs(value) * 100)
  if (paise > MAX_PAISES) return null
  return negative ? -paise : paise
}

/** Quantity is stored as numeric(10,2), so it is held as integer hundredths. */
export function parseQuantityToCenti(input: string | number | null | undefined): number | null {
  const value = parseAmountToPaise(input)
  return value === null ? null : value
}

export function formatPaise(paise: number): string {
  const sign = paise < 0 ? '-' : ''
  const abs = Math.abs(Math.trunc(paise))
  const rupees = Math.floor(abs / 100)
  const cents = abs % 100
  return `${sign}${rupees}.${String(cents).padStart(2, '0')}`
}

/** `125050` -> `1250.50`, the exact shape Postgres numeric wants. */
export function paiseToNumericString(paise: number): string {
  return formatPaise(paise)
}

/** Postgres `numeric` coming back over PostgREST (a JSON number or string). */
export function numericToPaise(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? Math.round(value * 100) : parseAmountToPaise(value)
  return parsed ?? 0
}

/** Rupees with Indian digit grouping, for display only. */
export function formatRupees(paise: number, options: { sign?: boolean } = {}): string {
  const negative = paise < 0
  const abs = Math.abs(Math.trunc(paise))
  // Whole rupees render without ".00"; paise amounts always show both decimals.
  const minimumFractionDigits = abs % 100 === 0 ? 0 : 2
  const body = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(abs / 100)

  if (negative) return `-₹${body}`
  return options.sign ? `+₹${body}` : `₹${body}`
}

export function formatRupeesShort(paise: number): string {
  const rupees = Math.abs(paise) / 100
  const minimumFractionDigits = Math.abs(Math.trunc(paise)) % 100 === 0 ? 0 : 2
  const body = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(rupees)
  return `${paise < 0 ? '-' : ''}₹${body}`
}

/** round(quantity * unit price), in paise. */
export function lineTotalPaise(quantityCenti: number, unitPricePaise: number): number {
  return Math.round((quantityCenti * unitPricePaise) / 100)
}

export function quantityFromCenti(centi: number): number {
  return centi / 100
}

/** Group digits so a long list of items stays readable in a receipt. */
export function formatQuantity(centi: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(centi / 100)
}