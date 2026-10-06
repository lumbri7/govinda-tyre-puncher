import type { Metadata } from 'next'

import { DateRangeFilter } from '@/components/date-range-filter'
import { DownloadCsv } from '@/components/download-csv'
import { Card, EmptyState, LoadError, PageTitle, ScrollTable, SectionTitle, Stat } from '@/components/ui'
import { defaultRange, formatDate, normalizeUuid, rangeToInstants } from '@/lib/dates'
import { formatPaise, formatRupees, numericToPaise } from '@/lib/money'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Reports' }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireOwner()
  const params = await searchParams
  const range = defaultRange()
  const from = typeof params.from === 'string' ? params.from : range.from
  const to = typeof params.to === 'string' ? params.to : range.to
  const staff = normalizeUuid(typeof params.staff === 'string' ? params.staff : undefined)
  const { from: fromInstant, to: toInstant } = rangeToInstants(from, to, session.timezone)

  const supabase = await createClient()
  const [summary, byDay, staffRows] = await Promise.all([
    supabase.rpc('sales_summary', {
      p_from: fromInstant,
      p_to: toInstant,
      p_created_by: staff || null,
    }),
    supabase.rpc('sales_by_day', {
      p_from: fromInstant,
      p_to: toInstant,
      p_created_by: staff || null,
    }),
    supabase
      .from('employees')
      .select('user_id')
      .eq('business_id', session.businessId)
      .eq('is_active', true),
  ])

  const totals = summary.data?.[0]
  const days = byDay.data ?? []
  const reportError = summary.error ?? byDay.error
  const staffIds = (staffRows.data ?? []).map((row) => row.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', staffIds.length > 0 ? staffIds : ['00000000-0000-0000-0000-000000000000'])

  const staffName = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const selectedStaffName = staff ? (staffName.get(staff) ?? 'Staff member') : 'All staff'

  const dayRows = [...days].reverse()
  const peak = dayRows.reduce((max, day) => Math.max(max, numericToPaise(day.total_sales)), 0)
  const servicePaise = numericToPaise(totals?.service_revenue)
  const partsPaise = numericToPaise(totals?.parts_revenue)
  const customPaise = numericToPaise(totals?.custom_revenue)
  const grandPaise = servicePaise + partsPaise + customPaise

  return (
    <div className="space-y-4">
      <PageTitle title="Sales report" subtitle={`${from} to ${to} · ${selectedStaffName}`} />

      <DateRangeFilter
        from={from}
        to={to}
        selects={[
          {
            param: 'staff',
            label: 'Staff member',
            value: staff,
            options: [
              { value: '', label: 'All staff' },
              ...(profiles ?? []).map((profile) => ({
                value: profile.id,
                label: profile.full_name,
              })),
            ],
          },
        ]}
      />

      {reportError ? (
        <LoadError title="Could not load the report" message={reportError.message} />
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Total sales"
          value={formatRupees(numericToPaise(totals?.total_sales))}
          tone="cash"
          hint={`${totals?.bill_count ?? 0} bills`}
        />
        <Stat
          label="Average bill"
          value={formatRupees(numericToPaise(totals?.average_bill))}
          tone="brand"
        />
        <Stat label="Services" value={formatRupees(servicePaise)} />
        <Stat label="Parts" value={formatRupees(partsPaise)} />
      </div>

      <Card>
        <SectionTitle>Where the money came from</SectionTitle>
        {grandPaise > 0 ? (
          <div className="space-y-2.5">
            <SplitBar
              label="Services"
              paise={servicePaise}
              total={grandPaise}
              tone="bg-brand-500"
            />
            <SplitBar label="Parts" paise={partsPaise} total={grandPaise} tone="bg-cash-500" />
            <SplitBar
              label="Custom items"
              paise={customPaise}
              total={grandPaise}
              tone="bg-ink-400"
            />
          </div>
        ) : (
          <p className="text-sm text-ink-500">No sales in this range.</p>
        )}
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionTitle>Day by day</SectionTitle>
          {dayRows.length > 0 ? (
            <DownloadCsv
              filename={`sales-${from}-to-${to}.csv`}
              rows={[
                ['Date', 'Bills', 'Sales'],
                ...dayRows.map((day) => [
                  day.day,
                  day.bill_count,
                  formatPaise(numericToPaise(day.total_sales)),
                ]),
              ]}
            />
          ) : null}
        </div>

        {dayRows.length === 0 ? (
          <EmptyState title="No sales in this range" description="Pick a wider date range." />
        ) : (
          <>
            {/* A phone gets one row per day with a full width bar, so the bar is
                still readable and nothing scrolls sideways. */}
            <ul className="space-y-2 md:hidden">
              {dayRows.map((day) => {
                const paise = numericToPaise(day.total_sales)
                return (
                  <li
                    key={day.day}
                    className="rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-ink-200/70"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-semibold text-ink-900">
                        {formatDate(`${day.day}T00:00:00Z`, session.timezone)}
                      </span>
                      <span className="tabular text-sm font-bold text-ink-950">
                        {formatRupees(paise)}
                      </span>
                    </div>
                    <p className="tabular text-xs text-ink-500">
                      {day.bill_count} bill{day.bill_count === 1 ? '' : 's'}
                    </p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{
                          width: `${peak > 0 ? Math.max(4, (paise / peak) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="hidden md:block">
              <ScrollTable>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-200 text-xs tracking-wide text-ink-500 uppercase">
                      <th className="py-2 pr-3 font-semibold">Date</th>
                      <th className="py-2 pr-3 font-semibold">Bills</th>
                      <th className="py-2 pr-3 font-semibold">Sales</th>
                      <th className="w-1/3 py-2 font-semibold">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {dayRows.map((day) => {
                      const paise = numericToPaise(day.total_sales)
                      return (
                        <tr key={day.day}>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-ink-800">
                            {formatDate(`${day.day}T00:00:00Z`, session.timezone)}
                          </td>
                          <td className="tabular py-2.5 pr-3 text-ink-600">{day.bill_count}</td>
                          <td className="tabular py-2.5 pr-3 font-semibold text-ink-950">
                            {formatRupees(paise)}
                          </td>
                          <td className="py-2.5">
                            <div
                              className="h-2.5 rounded-full bg-brand-500"
                              style={{
                                width: `${peak > 0 ? Math.max(4, (paise / peak) * 100) : 0}%`,
                              }}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </ScrollTable>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function SplitBar({
  label,
  paise,
  total,
  tone,
}: {
  label: string
  paise: number
  total: number
  tone: string
}) {
  const share = total > 0 ? Math.round((paise / total) * 100) : 0

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-700">{label}</span>
        <span className="tabular text-ink-500">
          {formatRupees(paise)} · {share}%
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${share}%` }} />
      </div>
    </div>
  )
}
