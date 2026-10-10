import Link from 'next/link'
import type { Metadata } from 'next'

import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Avatar } from '@/components/avatar'
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  LoadError,
  PageTitle,
  SectionTitle,
  Stat,
} from '@/components/ui'
import {
  addDays,
  formatTime,
  monthRangeToInstants,
  rangeToInstants,
  startOfMonthISO,
  todayISO,
} from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { readProfiles, type SafeProfile } from '@/lib/avatars'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Dashboard' }

export default async function OwnerDashboard() {
  const session = await requireOwner()
  const supabase = await createClient()
  const today = todayISO(session.timezone)

  const todayRange = rangeToInstants(today, today, session.timezone)
  const monthRange = monthRangeToInstants(startOfMonthISO(today), session.timezone)
  const yesterday = addDays(today, -1)
  const yesterdayRange = rangeToInstants(yesterday, yesterday, session.timezone)

  const results = await Promise.all([
    supabase.rpc('sales_summary', { p_from: todayRange.from, p_to: todayRange.to }),
    supabase.rpc('sales_summary', { p_from: monthRange.from, p_to: monthRange.to }),
    supabase.rpc('sales_summary', { p_from: yesterdayRange.from, p_to: yesterdayRange.to }),
    supabase
      .from('bills')
      .select('id, bill_number, customer_name, grand_total, created_at, created_by')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('salary_payments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase
      .from('salary_payments')
      .select('id, amount, payment_date, employee_id')
      .eq('status', 'pending')
      .order('payment_date', { ascending: false })
      .limit(5),
  ])
  const [
    todaySummary,
    monthSummary,
    yesterdaySummary,
    recentBills,
    pending,
    employees,
    pendingSalaries,
  ] = results
  const dashboardError = todaySummary.error ?? recentBills.error ?? pending.error ?? employees.error

  const todayTotals = todaySummary.data?.[0]
  const monthTotals = monthSummary.data?.[0]
  const yesterdayTotal = numericToPaise(yesterdaySummary.data?.[0]?.total_sales)
  const todayTotal = numericToPaise(todayTotals?.total_sales)
  const pendingCount = pending.count ?? 0
  const creatorProfiles = await creatorProfilesFor(
    (recentBills.data ?? []).map((bill) => bill.created_by),
  )

  return (
    <div className="space-y-5">
      {dashboardError ? (
        <LoadError title="Some numbers could not be loaded" message={dashboardError.message} />
      ) : null}

      <PageTitle title="Dashboard" subtitle={`${session.businessName} · today`} />

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Sales today"
          value={formatRupees(todayTotal)}
          hint={`${todayTotals?.bill_count ?? 0} bill${todayTotals?.bill_count === 1 ? '' : 's'}`}
          tone="cash"
        />
        <Stat
          label="Sales this month"
          value={formatRupees(numericToPaise(monthTotals?.total_sales))}
          hint={`${monthTotals?.bill_count ?? 0} bills`}
        />
        <Stat
          label="Yesterday"
          value={formatRupees(yesterdayTotal)}
          hint={
            todayTotal > 0
              ? `${formatRupees(Math.abs(yesterdayTotal - todayTotal))} ${todayTotal >= yesterdayTotal ? 'more' : 'less'} than yesterday`
              : undefined
          }
        />
        <Stat
          label="Average bill"
          value={formatRupees(numericToPaise(monthTotals?.average_bill))}
          tone="brand"
        />
      </div>

      {pendingCount > 0 ? (
        <Card className="space-y-3 border-cash-500/40 bg-cash-50">
          <div className="flex items-center justify-between">
            <p className="font-bold text-cash-700">
              {pendingCount} salary payment{pendingCount === 1 ? '' : 's'} waiting to be accepted
            </p>
            <Badge tone="cash">Action needed</Badge>
          </div>
          <ul className="space-y-1.5 text-sm text-ink-800">
            {(pendingSalaries.data ?? []).map((payment) => (
              <li key={payment.id} className="tabular flex justify-between">
                <span>{payment.payment_date}</span>
                <span className="font-semibold">
                  {formatRupees(numericToPaise(payment.amount))}
                </span>
              </li>
            ))}
          </ul>
          <LinkButton href="/owner/salary" size="md" variant="secondary">
            Open salary
          </LinkButton>
        </Card>
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Latest bills</SectionTitle>
          <Link href="/owner/bills" className="text-sm font-semibold text-brand-700">
            See all
          </Link>
        </div>

        {(recentBills.data ?? []).length === 0 ? (
          <EmptyState
            title="No bills yet"
            description="Bills created by your employees will appear here."
          />
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
            {(recentBills.data ?? []).map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/owner/bills/${bill.id}`}
                  className="flex items-center gap-3 px-3.5 py-3 no-underline"
                >
                  <Avatar
                    name={creatorProfiles.get(bill.created_by)?.full_name}
                    avatar={creatorProfiles.get(bill.created_by)?.avatar}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="tabular truncate text-sm font-bold text-ink-950">
                      {bill.bill_number}
                    </p>
                    <p className="truncate text-xs text-ink-600">
                      {bill.customer_name} · {creatorProfiles.get(bill.created_by)?.full_name ?? 'Unknown'} ·{' '}
                      {formatTime(bill.created_at, session.timezone)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-sm font-bold text-ink-950">
                    {formatRupees(numericToPaise(bill.grand_total))}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <LinkButton href="/owner/reports" variant="secondary" size="md">
          Sales reports
        </LinkButton>
        <LinkButton href="/owner/employees" variant="secondary" size="md">
          Staff ({employees.count ?? 0})
        </LinkButton>
        <LinkButton href="/owner/salary" variant="secondary" size="md">
          Salary &amp; payments
        </LinkButton>
        <LinkButton href="/owner/settings" variant="secondary" size="md">
          Shop settings
        </LinkButton>
      </div>

      <RealtimeRefresh watches={[{ table: 'bills' }, { table: 'salary_payments' }]} />
    </div>
  )

  async function creatorProfilesFor(ids: string[]): Promise<Map<string, SafeProfile>> {
    const { profiles } = await readProfiles(supabase, ids)
    return new Map(profiles.map((profile) => [profile.id, profile]))
  }
}
