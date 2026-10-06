import Link from 'next/link'
import type { Metadata } from 'next'

import { Badge, Card, EmptyState, LinkButton, LoadError, PageTitle, SectionTitle, Stat } from '@/components/ui'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { requireEmployee } from '@/lib/auth'
import { formatDateTime, todayISO, zonedStartOfDay } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Home' }

export default async function EmployeeHome() {
  const session = await requireEmployee()
  const supabase = await createClient()
  const today = todayISO(session.timezone)
  const dayStart = zonedStartOfDay(today, session.timezone).toISOString()

  const [todayBills, recentBills, pending] = await Promise.all([
    supabase
      .from('bills')
      .select('id, bill_number, grand_total')
      .gte('created_at', dayStart)
      .order('created_at', { ascending: false }),
    supabase
      .from('bills')
      .select('id, bill_number, customer_name, grand_total, created_at')
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('salary_payments')
      .select('id, amount, payment_date')
      .eq('status', 'pending')
      .order('payment_date', { ascending: false }),
  ])

  const dashboardError = todayBills.error ?? recentBills.error ?? pending.error

  const todayTotal = (todayBills.data ?? []).reduce(
    (sum, bill) => sum + numericToPaise(bill.grand_total),
    0,
  )
  const pendingList = pending.data ?? []

  return (
    <div className="space-y-5">
      <PageTitle
        title={`Hello, ${session.fullName.split(' ')[0]}`}
        subtitle={`${session.businessName} · today`}
      />

      {dashboardError ? (
        <LoadError title="Some numbers could not be loaded" message={dashboardError.message} />
      ) : null}

      <LinkButton href="/employee/bill/new" size="lg" className="text-lg">
        + New Bill
      </LinkButton>

      {pendingList.length > 0 ? (
        <Card className="border-cash-500/30 bg-cash-50">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-cash-700">
                {pendingList.length === 1 ? 'Salary payment waiting' : `${pendingList.length} salary payments waiting`}
              </p>
              <p className="mt-0.5 text-sm text-ink-700">
                {pendingList[0]?.amount ? formatRupees(numericToPaise(pendingList[0].amount)) : ''} paid on{' '}
                {pendingList[0]?.payment_date}
              </p>
            </div>
          </div>
          <Link
            href="/employee/salary"
            className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-cash-600 px-4 text-sm font-semibold text-white no-underline"
          >
            Review and accept
          </Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bills today" value={String((todayBills.data ?? []).length)} />
        <Stat label="Sales today" value={formatRupees(todayTotal)} tone="cash" />
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle>Recent bills</SectionTitle>
          <Link href="/employee/bills" className="text-sm font-semibold text-brand-700">
            See all
          </Link>
        </div>

        {(recentBills.data ?? []).length === 0 ? (
          <EmptyState
            title="No bills yet"
            description="Create your first bill and it will show up here."
            action={<LinkButton href="/employee/bill/new" size="sm">Create a bill</LinkButton>}
          />
        ) : (
          <ul className="space-y-2">
            {(recentBills.data ?? []).map((bill) => (
              <li key={bill.id}>
                <Link
                  href={`/employee/bills/${bill.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3.5 no-underline shadow-sm ring-1 ring-ink-200/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {bill.bill_number} · {bill.customer_name}
                    </p>
                    <p className="text-xs text-ink-500">{formatDateTime(bill.created_at, session.timezone)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-sm font-bold text-ink-950">
                      {formatRupees(numericToPaise(bill.grand_total))}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="bg-brand-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-brand-900">Your salary</p>
            <p className="text-xs text-brand-800">
              {pendingList.length > 0 ? (
                <Badge tone="cash">Action needed</Badge>
              ) : (
                'All payments accepted'
              )}
            </p>
          </div>
          <Link
            href="/employee/salary"
            className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-800 no-underline shadow-sm"
          >
            Open
          </Link>
        </div>
      </Card>

      <RealtimeRefresh
        watches={[
          { table: 'bills', filter: `created_by=eq.${session.userId}` },
          { table: 'salary_payments' },
        ]}
      />
    </div>
  )
}