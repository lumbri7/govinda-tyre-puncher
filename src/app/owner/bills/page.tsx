import Link from 'next/link'
import type { Metadata } from 'next'

import { DateRangeFilter } from '@/components/date-range-filter'
import { SearchField } from '@/components/search-field'
import { Card, EmptyState, PageTitle, ScrollTable, Stat } from '@/components/ui'
import { defaultRange, formatDateTime, rangeToInstants } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Bills' }

const PAGE_SIZE = 25

/**
 * PostgREST reads `.`, `,` and quotes as filter syntax, and `%`/`_` as SQL LIKE
 * wildcards, so anything a person can type is stripped before it reaches an
 * `ilike` pattern. Searching for "50%" finds bills containing "50".
 */
function searchPattern(value: string): string | null {
  const cleaned = value.replace(/[%_\\,().*"']/g, '').trim()
  return cleaned ? `%${cleaned}%` : null
}

export default async function OwnerBillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireOwner()
  const params = await searchParams
  const range = defaultRange()
  const from = typeof params.from === 'string' ? params.from : range.from
  const to = typeof params.to === 'string' ? params.to : range.to
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const query = typeof params.q === 'string' ? params.q.slice(0, 60) : ''
  const { from: fromInstant, to: toInstant } = rangeToInstants(from, to, session.timezone)

  const supabase = await createClient()
  const offset = (page - 1) * PAGE_SIZE

  // An employee search has to resolve names to ids first, because `bills` only
  // stores who created it.
  const pattern = searchPattern(query)
  const { data: namedStaff } = pattern
    ? await supabase.from('profiles').select('id').ilike('full_name', pattern)
    : { data: [] as { id: string }[] }
  const staffIds = (namedStaff ?? []).map((profile) => profile.id)

  const textFilters = ['bill_number', 'customer_name', 'vehicle_number']
    .map((column) => `${column}.ilike.${JSON.stringify(pattern)}`)
    .join(',')

  const billsQuery = supabase
    .from('bills')
    .select('id, bill_number, customer_name, vehicle_number, grand_total, created_at, created_by', {
      count: 'exact',
    })
    .gte('created_at', fromInstant)
    .lt('created_at', toInstant)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (pattern) {
    const or =
      staffIds.length > 0 ? `${textFilters},created_by.in.(${staffIds.join(',')})` : textFilters
    billsQuery.or(or)
  }

  const [{ data: bills, count, error }, { data: creators }] = await Promise.all([
    billsQuery,
    supabase.from('profiles').select('id, full_name'),
  ])

  const names = new Map((creators ?? []).map((profile) => [profile.id, profile.full_name]))
  const list = bills ?? []
  const total = count ?? 0
  const totalValue = list.reduce((sum, bill) => sum + numericToPaise(bill.grand_total), 0)

  const pageLink = (next: number) => {
    const search = new URLSearchParams({ from, to, page: String(next) })
    if (query) search.set('q', query)
    return `/owner/bills?${search.toString()}`
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="All bills"
        subtitle={query ? `${from} to ${to} · matching “${query}”` : `${from} to ${to} · all staff`}
      />

      <div className="space-y-3">
        <DateRangeFilter from={from} to={to} />
        <SearchField
          label="Search"
          placeholder="Bill number, customer, vehicle or staff"
          defaultValue={query}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bills" value={String(total)} />
        <Stat label="On this page" value={formatRupees(totalValue)} tone="cash" />
      </div>

      {error ? (
        <Card className="ring-bad-200">
          <p className="text-sm font-semibold text-bad-700">Could not load bills.</p>
          <p className="mt-1 text-sm text-ink-600">
            {error.message} Pull down to try again, or pick a shorter date range.
          </p>
        </Card>
      ) : list.length === 0 ? (
        <EmptyState
          title={query ? 'Nothing matched that search' : 'No bills in this range'}
          description={query ? 'Try fewer words, or clear the search.' : 'Try a wider date range.'}
        />
      ) : (
        <>
          {/* Phones get one card per bill: the whole card opens it, so there is
              nothing small to aim at and nothing to scroll sideways. */}
          <ul className="space-y-2 md:hidden">
            {list.map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/owner/bills/${bill.id}`}
                  className="block rounded-2xl bg-white p-4 no-underline shadow-sm ring-1 ring-ink-200/70"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tabular text-sm font-bold text-ink-950">
                      {bill.bill_number}
                    </span>
                    <span className="tabular shrink-0 text-base font-bold text-ink-950">
                      {formatRupees(numericToPaise(bill.grand_total))}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-semibold text-ink-900">{bill.customer_name}</p>
                  <p className="tabular truncate text-sm text-ink-600">
                    {bill.vehicle_number} · {names.get(bill.created_by) ?? 'Unknown'}
                  </p>
                  <p className="mt-1 text-xs text-ink-500">
                    {formatDateTime(bill.created_at, session.timezone)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* From a tablet up the shop compares bills in columns instead. */}
          <div className="hidden md:block">
            <ScrollTable>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-xs tracking-wide text-ink-500 uppercase">
                    <th className="py-2 pr-3 font-semibold">Bill</th>
                    <th className="py-2 pr-3 font-semibold">Customer</th>
                    <th className="py-2 pr-3 font-semibold">By</th>
                    <th className="py-2 pr-3 font-semibold">When</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {list.map((bill) => (
                    <tr key={bill.id} className="align-top">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/owner/bills/${bill.id}`}
                          className="tabular font-semibold text-brand-700 no-underline"
                        >
                          {bill.bill_number}
                        </Link>
                        <p className="tabular text-xs text-ink-500">{bill.vehicle_number}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-ink-800">{bill.customer_name}</td>
                      <td className="py-2.5 pr-3 text-ink-600">
                        {names.get(bill.created_by) ?? '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-ink-500">
                        {formatDateTime(bill.created_at, session.timezone)}
                      </td>
                      <td className="tabular py-2.5 text-right font-semibold text-ink-950">
                        {formatRupees(numericToPaise(bill.grand_total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollTable>
          </div>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        {page > 1 ? (
          <Link
            href={pageLink(page - 1)}
            className="inline-flex min-h-12 items-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
          >
            &larr; Newer
          </Link>
        ) : (
          <span />
        )}
        {offset + list.length < total ? (
          <Link
            href={pageLink(page + 1)}
            className="inline-flex min-h-12 items-center rounded-xl bg-white px-4 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
          >
            Older &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>

      <Card className="bg-brand-50">
        <p className="text-sm text-brand-900">
          Showing bills created in the shop timezone ({session.timezone}).
        </p>
      </Card>
    </div>
  )
}
