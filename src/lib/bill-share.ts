import { formatDate } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { VEHICLE_LABELS } from '@/lib/catalog'
import type { Tables } from '@/lib/database.types'

/**
 * Everything needed to send a bill to a customer. Pure data, no browser APIs,
 * so the same values can build the WhatsApp message on the server and the
 * native share payload in the browser.
 */
export type BillShareDetails = {
  shopName: string
  billNumber: string
  createdAt: string
  timezone: string
  customerName: string
  customerPhone: string | null
  vehicleType: Tables<'bills'>['vehicle_type']
  vehicleNumber: string
  vehicleDescription: string | null
  grandTotal: number
}

/**
 * Indian numbers are stored as `+91XXXXXXXXXX`. WhatsApp needs the bare
 * country code and number, with no `+`, spaces or dashes.
 */
export function whatsappInternationalNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8 || digits.length > 15) return null
  return digits
}

/**
 * A short, professional bill summary the employee can send from their own
 * WhatsApp. It deliberately stays text: nothing here claims a PDF is attached.
 */
export function billShareSummary(bill: BillShareDetails): string {
  const lines = [
    `Hello ${bill.customerName},`,
    '',
    `Your service bill from ${bill.shopName} is ready.`,
    '',
    `Bill No: ${bill.billNumber}`,
    `Date: ${formatDate(bill.createdAt, bill.timezone)}`,
    `Vehicle: ${VEHICLE_LABELS[bill.vehicleType]} ${bill.vehicleNumber}`,
  ]

  if (bill.vehicleDescription) lines.push(`Work done: ${bill.vehicleDescription}`)
  lines.push(
    '',
    `Total: ${formatRupees(numericToPaise(bill.grandTotal))}`,
    '',
    'Thank you for visiting us.',
  )

  return lines.join('\n')
}

/**
 * `https://wa.me/<number>?text=<encoded message>`. This only opens WhatsApp
 * with the message ready to send: the employee always presses send, so the app
 * never sends anything on its own.
 */
export function whatsappBillLink(bill: BillShareDetails): string | null {
  const number = whatsappInternationalNumber(bill.customerPhone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(billShareSummary(bill))}`
}
