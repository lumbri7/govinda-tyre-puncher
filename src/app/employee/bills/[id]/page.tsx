import Link from 'next/link'
import type { Metadata } from 'next'

import { BillActions } from '@/components/bill-actions'
import { BillDocument, type BillWithItems } from '@/components/bill-document'
import { ClearBillDraft } from '@/components/clear-bill-draft'
import { billShareSummary, whatsappBillLink } from '@/lib/bill-share'
import { LoadError } from '@/components/ui'
import { requireEmployee } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Bill' }

export default async function EmployeeBillPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireEmployee()
  const { id } = await params
  const query = await searchParams

  const supabase = await createClient()
  const { data: bill, error } = await supabase.from('bills').select('*').eq('id', id).maybeSingle()

  if (error) {
    return <LoadError title="Could not load this bill" retry />
  }

  // RLS already hides other people's bills: a missing bill is a 404, not a
  // permission error that would confirm the id exists.
  if (!bill) {
    return (
      <p className="rounded-2xl bg-white p-6 text-center text-sm text-ink-600 shadow-sm ring-1 ring-ink-200/70">
        This bill does not exist or is not yours to view.
      </p>
    )
  }

  const { data: items } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', bill.id)
    .order('sort_order')

  const withItems = { ...bill, items: items ?? [] } as BillWithItems
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
        <>
          <ClearBillDraft />
          <p className="no-print rounded-xl bg-good-50 px-3 py-2.5 text-sm font-semibold text-good-700">
            Bill saved.
          </p>
        </>
      ) : null}

      <div className="no-print flex items-center justify-between gap-3">
        <Link href="/employee/bills" className="text-sm font-semibold text-brand-700 no-underline">
          &larr; My bills
        </Link>
      </div>

      <BillActions
        printHref={`/bill/${bill.id}/print`}
        summary={billShareSummary(shareDetails)}
        whatsappUrl={whatsappBillLink(shareDetails)}
      />

      {bill.voided_at ? (
        <p className="rounded-xl border border-bad-200 bg-bad-50 px-3 py-2.5 text-sm font-semibold text-bad-700">
          This bill was voided by the owner and is not part of the shop&apos;s accounts.
        </p>
      ) : null}

      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
        <BillDocument
          bill={withItems}
          shopName={session.businessName}
          timezone={session.timezone}
        />
      </div>
    </div>
  )
}
