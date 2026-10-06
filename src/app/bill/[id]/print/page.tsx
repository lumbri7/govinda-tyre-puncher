import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AutoPrint } from '@/components/auto-print'
import { BillDocument, type BillWithItems } from '@/components/bill-document'
import { requireSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Print bill' }

/**
 * The printable bill: the document and nothing else.
 *
 * This route sits outside the owner and employee areas on purpose, so it has no
 * app header, no navigation and no buttons. It is reachable by anyone with a
 * session, and the bill is fetched through the same RLS rules as the screen
 * view, so an employee still cannot print somebody else's bill.
 */
export default async function PrintBillPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  const { id } = await params
  const supabase = await createClient()

  const { data: bill } = await supabase.from('bills').select('*').eq('id', id).maybeSingle()
  if (!bill) notFound()

  const { data: items } = await supabase
    .from('bill_items')
    .select('*')
    .eq('bill_id', bill.id)
    .order('sort_order')

  const { data: creator } =
    session.role === 'owner'
      ? await supabase.from('profiles').select('full_name').eq('id', bill.created_by).maybeSingle()
      : { data: null }

  return (
    <main className="min-h-dvh bg-white">
      <AutoPrint />
      <BillDocument
        bill={{ ...bill, items: items ?? [] } as BillWithItems}
        shopName={session.businessName}
        timezone={session.timezone}
        createdByName={creator?.full_name}
      />
    </main>
  )
}
