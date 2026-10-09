import Link from 'next/link'
import type { Metadata } from 'next'

import { Badge, EmptyState, LinkButton, LoadError, PageTitle } from '@/components/ui'
import { formatDateTime } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { requireEmployee } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My Bills' }

const PAGE_SIZE = 20

export default async function MyBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireEmployee()
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE

  const supabase = await createClient()
  const { data: bills, count, error } = await supabase
    .from('bills')
    .select('id, bill_number, customer_name, vehicle_number, grand_total, created_at, voided_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to)

  const list = bills ?? []
  const total = count ?? 0
  const hasNext = from + list.length < total

  return (
    <div className="space-y-4">
      <PageTitle title="My bills" subtitle={`${total} bill${total === 1 ? '' : 's'} created by you`} />

      {error ? (
        <LoadError title="Could not load your bills" retry />
      ) : list.length === 0 ? (
        <EmptyState
          title="No bills yet"
          description="Bills you create will be listed here."
          action={<LinkButton href="/employee/bill/new" size="sm">Create a bill</LinkButton>}
        />
      ) : (
        <ul className="space-y-2">
          {list.map((bill) => (
            <li key={bill.id}>
              <Link
                href={`/employee/bills/${bill.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 no-underline shadow-sm ring-1 ring-ink-200/70"
              >
                <div className="min-w-0 flex-1">
                  <p className="tabular truncate text-sm font-bold text-ink-950">{bill.bill_number}</p>
                  <p className="truncate text-sm text-ink-700">
                    {bill.customer_name} · <span className="tabular">{bill.vehicle_number}</span>
                  </p>
                  <p className="text-xs text-ink-500">
                    {formatDateTime(bill.created_at, session.timezone)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-bold text-ink-950">
                    {formatRupees(numericToPaise(bill.grand_total))}
                  </p>
                  {bill.voided_at ? (
                    <Badge tone="bad">Voided</Badge>
                  ) : (
                    <Badge tone="brand">View</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {page > 1 || hasNext ? (
        <nav className="flex items-center justify-between gap-3 pt-2">
          {page > 1 ? (
            <Link
              href={`/employee/bills?page=${page - 1}`}
              className="inline-flex min-h-12 items-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
            >
              &larr; Newer
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link
              href={`/employee/bills?page=${page + 1}`}
              className="inline-flex min-h-12 items-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
            >
              Older &rarr;
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  )
}