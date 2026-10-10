import Link from 'next/link'
import type { Metadata } from 'next'

import { AcceptPaymentForm } from '@/app/employee/salary/accept-payment'
import { Avatar } from '@/components/avatar'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Badge, Card, EmptyState, LoadError, PageTitle, SectionTitle, Stat } from '@/components/ui'
import { formatDate, monthValue, todayISO } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { readProfiles } from '@/lib/avatars'
import { requireEmployee } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Salary' }

export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireEmployee()
  const params = await searchParams
  const month = typeof params.month === 'string' ? params.month : monthValue(todayISO(session.timezone))

  const supabase = await createClient()

  const [{ data: summary, error: summaryError }, { data: payments }, { profiles: selfProfiles }] =
    await Promise.all([
      supabase.rpc('my_salary_summary', { p_month: `${month}-01` }),
      supabase
        .from('salary_payments')
        .select('id, amount, payment_date, status, note, acknowledged_at, created_at')
        .order('payment_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(60),
      readProfiles(supabase, [session.userId]),
    ])

  const self = selfProfiles[0] ?? null

  const totals = summary?.[0]
  const salaryError = summaryError
  const pending = (payments ?? []).filter((payment) => payment.status === 'pending')
  const history = (payments ?? []).filter((payment) => payment.status !== 'pending')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Avatar name={self?.full_name} avatar={self?.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <PageTitle title="My salary" subtitle={formatDate(`${month}-01T00:00:00Z`, session.timezone)} />
        </div>
      </div>

      {salaryError ? (
        <LoadError title="Could not load your salary" message={salaryError.message} />
      ) : null}

      {pending.length > 0 ? (
        <Card className="space-y-3 border-cash-500/40 bg-cash-50">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-cash-700">Waiting for your acceptance</h2>
            <Badge tone="cash">{pending.length}</Badge>
          </div>

          <ul className="space-y-2">
            {pending.map((payment) => (
              <li key={payment.id} className="rounded-xl bg-white p-3.5 shadow-sm ring-1 ring-cash-500/20">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-lg font-bold text-ink-950">
                      {formatRupees(numericToPaise(payment.amount))}
                    </p>
                    <p className="text-xs text-ink-600">Paid on {payment.payment_date}</p>
                    {payment.note ? <p className="mt-1 text-xs text-ink-500">{payment.note}</p> : null}
                  </div>
                  <AcceptPaymentForm paymentId={payment.id} />
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-cash-700">
            Accepting confirms that you received this amount. Ask the owner if something looks wrong.
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Monthly" value={formatRupees(numericToPaise(totals?.monthly_salary))} />
        <Stat
          label="Paid"
          tone="good"
          value={formatRupees(numericToPaise(totals?.paid))}
        />
        <Stat
          label="Remaining"
          tone="cash"
          value={formatRupees(numericToPaise(totals?.remaining))}
        />
      </div>

      <section>
        <SectionTitle>Payment history</SectionTitle>
        {history.length === 0 ? (
          <EmptyState title="No payments yet" description="Salary payments will be listed here." />
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
            {history.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="tabular text-sm font-bold text-ink-950">
                    {formatRupees(numericToPaise(payment.amount))}
                  </p>
                  <p className="text-xs text-ink-500">
                    {payment.payment_date}
                    {payment.note ? ` · ${payment.note}` : ''}
                  </p>
                </div>
                <Badge tone={payment.status === 'confirmed' ? 'good' : 'neutral'}>
                  {payment.status === 'confirmed' ? 'Accepted' : 'Cancelled'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-ink-400">
        Showing recent payments.{' '}
        <Link href="/employee/alerts" className="font-semibold text-brand-700">
          See your alerts
        </Link>
      </p>

      <RealtimeRefresh watches={[{ table: 'salary_payments' }, { table: 'notifications', filter: `user_id=eq.${session.userId}` }]} />
    </div>
  )
}