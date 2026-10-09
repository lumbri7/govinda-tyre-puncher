import { VEHICLE_LABELS } from '@/lib/catalog'
import { formatDate, formatTime } from '@/lib/dates'
import { formatQuantity, formatRupees, numericToPaise } from '@/lib/money'
import type { Tables } from '@/lib/database.types'

export type BillWithItems = Tables<'bills'> & { items: Tables<'bill_items'>[] }

const GROUPS = [
  { type: 'service', title: 'Services' },
  { type: 'part', title: 'Parts' },
  { type: 'custom', title: 'Other items' },
] as const

/**
 * The bill itself, and nothing else: no navigation, no buttons, no app chrome.
 *
 * The same component is used for the screen preview and for the standalone
 * print route, so what the customer reads on screen is exactly what comes out
 * of the printer or the PDF. Everything is a server component because a bill is
 * static text: there is no reason to ship JavaScript for it.
 */
export function BillDocument({
  bill,
  shopName,
  timezone,
  createdByName,
}: {
  bill: BillWithItems
  shopName: string
  timezone: string
  createdByName?: string
}) {
  const groups = GROUPS.map((group) => ({
    ...group,
    items: bill.items.filter((item) => item.item_type === group.type),
  })).filter((group) => group.items.length > 0)

  const subtotals = [
    { label: 'Services', value: numericToPaise(bill.service_total) },
    { label: 'Parts', value: numericToPaise(bill.parts_total) },
    { label: 'Other items', value: numericToPaise(bill.custom_items_total) },
  ].filter(
    (row, index) => row.value !== 0 || groups.some((group) => group.type === GROUPS[index].type),
  )

  return (
    <article className="bill-document mx-auto w-full max-w-[42rem] bg-white px-5 py-6 text-ink-950 sm:px-8">
      <header className="border-b-2 border-ink-900 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">{shopName}</h1>
        <p className="mt-0.5 text-xs font-semibold tracking-[0.18em] text-ink-500 uppercase">
          Service Bill
        </p>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="tabular text-base font-bold text-ink-950">{bill.bill_number}</p>
          <p className="tabular text-sm text-ink-700">
            {formatDate(bill.created_at, timezone)} &middot; {formatTime(bill.created_at, timezone)}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-[0.7rem] font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Customer
          </dt>
          <dd className="mt-1 text-base font-bold text-ink-950">{bill.customer_name}</dd>
          {bill.customer_phone ? (
            <dd className="tabular text-sm text-ink-700">{bill.customer_phone}</dd>
          ) : null}
        </div>
        <div>
          <dt className="text-[0.7rem] font-semibold tracking-[0.12em] text-ink-500 uppercase">
            Vehicle
          </dt>
          <dd className="mt-1 text-base font-bold text-ink-950">
            {VEHICLE_LABELS[bill.vehicle_type]}
            {bill.vehicle_number ? (
              <span className="tabular ml-2 font-semibold tracking-wider">
                {bill.vehicle_number}
              </span>
            ) : null}
          </dd>
          {bill.vehicle_description ? (
            <dd className="text-sm text-ink-700">{bill.vehicle_description}</dd>
          ) : null}
        </div>
      </dl>

      <table className="mt-5 w-full border-collapse text-sm">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-ink-300 text-[0.7rem] tracking-[0.12em] text-ink-500 uppercase">
            <th className="py-2 pr-3 text-left font-semibold">Item</th>
            <th className="w-16 py-2 pr-3 text-right font-semibold">Qty</th>
            <th className="w-28 py-2 pr-3 text-right font-semibold">Rate</th>
            <th className="w-32 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.type}>
            <tr>
              <th
                colSpan={4}
                className="border-b border-ink-200 pt-4 pb-1.5 text-left text-[0.7rem] font-bold tracking-[0.12em] text-ink-500 uppercase"
              >
                {group.title}
              </th>
            </tr>
            {group.items.map((item) => (
              <tr key={item.id} className="border-b border-ink-100 align-top">
                <td className="py-2 pr-3">
                  <span className="font-medium text-ink-950">{item.name}</span>
                  <span className="tabular block text-xs text-ink-500 sm:hidden">
                    {formatQuantity(numericToPaise(String(item.quantity)))} &times;{' '}
                    {formatRupees(numericToPaise(String(item.unit_price)))}
                  </span>
                </td>
                <td className="tabular py-2 pr-3 text-right text-ink-700">
                  {formatQuantity(numericToPaise(String(item.quantity)))}
                </td>
                <td className="tabular hidden py-2 pr-3 text-right text-ink-700 sm:table-cell">
                  {formatRupees(numericToPaise(String(item.unit_price)))}
                </td>
                <td className="tabular py-2 text-right font-semibold text-ink-950">
                  {formatRupees(numericToPaise(String(item.line_total)))}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="mt-5 ml-auto w-full max-w-xs space-y-1.5 border-t-2 border-ink-900 pt-3 text-sm">
        {subtotals.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3">
            <span className="text-ink-600">{row.label}</span>
            <span className="tabular font-medium text-ink-950">{formatRupees(row.value)}</span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 pt-2">
          <span className="text-base font-bold text-ink-950">Grand Total</span>
          <span className="tabular text-2xl font-bold text-ink-950">
            {formatRupees(numericToPaise(bill.grand_total))}
          </span>
        </div>
      </div>

      <footer className="mt-6 border-t border-ink-200 pt-3 text-center text-xs text-ink-500">
        <p>Thank you, drive safely.</p>
        {/* The employee's name at the moment of saving, snapshotted by
            create_bill so every copy stays accurate after a rename and an
            employee's own PDF is not missing their name. */}
        {bill.serviced_by ?? createdByName ? (
          <p className="mt-1">Serviced by {bill.serviced_by ?? createdByName}</p>
        ) : null}
        {bill.voided_at ? (
          <p className="mt-2 border-t border-ink-100 pt-2 font-semibold text-bad-700">
            This bill was voided and is not part of the shop&apos;s accounts.
          </p>
        ) : null}
      </footer>
    </article>
  )
}
