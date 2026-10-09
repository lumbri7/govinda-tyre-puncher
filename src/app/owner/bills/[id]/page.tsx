import Link from 'next/link'
import type { Metadata } from 'next'

import { BillActions } from '@/components/bill-actions'
import { BillDocument, type BillWithItems } from '@/components/bill-document'
import { VoidBillForm } from '@/app/owner/bills/[id]/void-bill-form'
import { billShareSummary, whatsappBillLink } from '@/lib/bill-share'
import { LoadError } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatRupees, numericToPaise } from '@/lib/money'

export const metadata: Metadata = { title: 'Bill' }

export default async function OwnerBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireOwner()
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()

  const { data: bill, error } = await supabase.from('bills').select('*').eq('id', id).maybeSingle()
  if (error) {
    return <LoadError title="Could not load this bill" retry />
  }

  if (!bill) {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink-600 shadow-sm ring-1 ring-ink-200/70">
        This bill does not exist.
      </p>
    )
  }

  const { data: items, error: itemsError } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', bill.id)
    .order('sort_order')

  if (itemsError) {
    return <LoadError title="Could not load this bill" message={itemsError.message} />
  }

  const shareDetails = {
    shopName: session.businessName,
    billNumber: bill.bill_number,
    createdAt: bill.created_at,
    timezone: session.timezone,
    customerName: bill.customer_name,
    customerPhone: bill.customer_phone,
    vehicleType: bill.vehicle_type,
    vehicleNumber: bill.vehicle_number,
    vehicleDescription: bill.vehicle_description,
    grandTotal: bill.grand_total,
  }

  return (
    <div className="space-y-4">
      {query.saved === '1' ? (
        <p className="no-print rounded-xl bg-good-50 px-3 py-2.5 text-sm font-semibold text-good-700">
          Bill saved.
        </p>
      ) : null}

      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/owner/bills" className="text-sm font-semibold text-brand-700 no-underline">
          &larr; All bills
        </Link>
      </div>

      <BillActions
        printHref={`/bill/${bill.id}/print`}
        summary={billShareSummary(shareDetails)}
        whatsappUrl={whatsappBillLink(shareDetails)}
      />

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
        <BillDocument
          bill={{ ...bill, items: items ?? [] } as BillWithItems}
          shopName={session.businessName}
          timezone={session.timezone}
        />
      </div>

      {bill.voided_at ? (
        <div className="no-print rounded-2xl border border-bad-200 bg-bad-50 p-4">
          <p className="text-sm font-bold text-bad-700">
            Voided on {formatDateTime(bill.voided_at, session.timezone)}
          </p>
          <p className="mt-1 text-sm text-ink-700">
            {bill.void_reason}. This bill no longer counts in sales totals.
          </p>
        </div>
      ) : (
        <VoidBillForm
          billId={bill.id}
          billNumber={bill.bill_number}
          customerName={bill.customer_name}
          grandTotal={formatRupees(numericToPaise(bill.grand_total))}
        />
      )}
    </div>
  )
}
