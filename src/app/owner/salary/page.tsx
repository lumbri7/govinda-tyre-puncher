import Link from 'next/link'
import type { Metadata } from 'next'

import { CancelPaymentForm } from '@/app/owner/salary/cancel-payment'
import { RecordPaymentButton } from '@/app/owner/salary/record-payment'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { Badge, Card, EmptyState, LoadError, PageTitle, SectionTitle } from '@/components/ui'
import { addMonths, formatDate, monthValue, startOfMonthISO, todayISO } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Salary' }

export default async function OwnerSalaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await requireOwner()
  const params = await searchParams
  const requested = typeof params.month === 'string' ? params.month : ''
  const current = startOfMonthISO(requested || todayISO(session.timezone))
  const previous = addMonths(current, -1)
  const next = addMonths(current, 1)

  const supabase = await createClient()
  const [
    { data: overview, error: overviewError },
    { data: pendingPayments },
    { data: recent },
  ] = await Promise.all([
    supabase.rpc('salary_overview', { p_month: current }),
    supabase
      .from('salary_payments')
      .select('id, employee_id, amount, payment_date, status, note')
      .eq('status', 'pending')
      .order('payment_date', { ascending: false }),
    supabase
      .from('salary_payments')
      .select('id, employee_id, amount, payment_date, status')
      .order('payment_date', { ascending: false })
      .limit(40),
  ])

  const rows = overview ?? []
  const salaryError = overviewError
  const employeeIds = [
    ...new Set([...(pendingPayments ?? []).map((payment) => payment.employee_id), ...rows.map((row) => row.employee_id)]),
  ]
  const { data: employees } = await supabase
    .from('employees')
    .select('id, user_id, monthly_salary, is_active')
    .in('id', employeeIds.length > 0 ? employeeIds : ['00000000-0000-0000-0000-000000000000'])
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in(
      'id',
      (employees ?? []).length > 0
        ? (employees ?? []).map((employee) => employee.user_id)
        : ['00000000-0000-0000-0000-000000000000'],
    )

  const nameOf = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]))
  const nameForEmployee = (employeeId: string) => {
    const employee = (employees ?? []).find((row) => row.id === employeeId)
    return employee ? (nameOf.get(employee.user_id) ?? 'Unknown') : 'Unknown'
  }

  const totalSalary = rows.reduce((sum, row) => sum + numericToPaise(row.monthly_salary), 0)
  const totalPaid = rows.reduce((sum, row) => sum + numericToPaise(row.paid), 0)
  const totalRemaining = rows.reduce((sum, row) => sum + numericToPaise(row.remaining), 0)

  return (
    <div className="space-y-4">
      <PageTitle
        title="Salary"
        subtitle={formatDate(`${current}T00:00:00Z`, session.timezone)}
        action={
          <div className="flex items-center gap-1">
            <Link
              href={`/owner/salary?month=${monthValue(previous)}`}
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
            >
              &larr;
            </Link>
            <Link
              href={`/owner/salary?month=${monthValue(next)}`}
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-ink-800 shadow-sm ring-1 ring-ink-200"
            >
              &rarr;
            </Link>
          </div>
        }
      />

      {salaryError ? (
        <LoadError title="Could not load the salary ledger" message={salaryError.message} />
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Salaries</p>
          <p className="tabular text-lg font-bold text-ink-950">{formatRupees(totalSalary)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Paid</p>
          <p className="tabular text-lg font-bold text-good-700">{formatRupees(totalPaid)}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Remaining</p>
          <p className="tabular text-lg font-bold text-cash-700">{formatRupees(totalRemaining)}</p>
        </Card>
      </div>

      <section className="space-y-2">
        <SectionTitle>This month</SectionTitle>

        {rows.length === 0 ? (
          <EmptyState
            title="No employees yet"
            description="Add staff to record their monthly salary."
            action={
              <Link
                href="/owner/employees?add=1"
                className="inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white no-underline"
              >
                Add employee
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.employee_id}>
                <Card className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                        <span className="truncate">{row.full_name}</span>
                        {row.is_active ? null : <Badge tone="bad">Disabled</Badge>}
                      </p>
                      <p className="tabular text-xs text-ink-500">
                        {row.phone ?? 'No number'} · {formatRupees(numericToPaise(row.monthly_salary))} per month
                      </p>
                    </div>
                    <RecordPaymentButton
                      employeeId={row.employee_id}
                      employeeName={row.full_name}
                      remainingPaise={numericToPaise(row.remaining)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                    <div className="min-w-fit">
                      <p className="text-xs text-ink-500">Paid</p>
                      <p className="tabular font-semibold text-good-700">
                        {formatRupees(numericToPaise(row.paid))}
                      </p>
                    </div>
                    <div className="min-w-fit">
                      <p className="text-xs text-ink-500">Remaining</p>
                      <p className="tabular font-semibold text-cash-700">
                        {formatRupees(numericToPaise(row.remaining))}
                      </p>
                    </div>
                    <div className="min-w-fit">
                      <p className="text-xs text-ink-500">Waiting</p>
                      <p className="tabular font-semibold text-ink-900">
                        {row.pending_acknowledgements}
                      </p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Waiting for acceptance</SectionTitle>
        {(pendingPayments ?? []).length === 0 ? (
          <EmptyState title="Nothing pending" description="Every recorded payment has been accepted." />
        ) : (
          <ul className="space-y-2">
            {(pendingPayments ?? []).map((payment) => (
              <li key={payment.id}>
                <Card className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-950">
                      {nameForEmployee(payment.employee_id)}
                    </p>
                    <p className="tabular text-xs text-ink-500">
                      {formatRupees(numericToPaise(payment.amount))} · paid {payment.payment_date}
                      {payment.note ? ` · ${payment.note}` : ''}
                    </p>
                  </div>
                  <CancelPaymentForm paymentId={payment.id} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Recent payments (all months)</SectionTitle>
        {(recent ?? []).length === 0 ? (
          <EmptyState title="No payments recorded yet" />
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
            {(recent ?? []).map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                <span className="tabular w-24 shrink-0 text-ink-500">{payment.payment_date}</span>
                <span className="min-w-0 flex-1 truncate text-ink-800">
                  {nameForEmployee(payment.employee_id)}
                </span>
                <span className="tabular font-semibold text-ink-950">
                  {formatRupees(numericToPaise(payment.amount))}
                </span>
                <Badge
                  tone={
                    payment.status === 'confirmed'
                      ? 'good'
                      : payment.status === 'pending'
                        ? 'cash'
                        : 'neutral'
                  }
                >
                  {payment.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RealtimeRefresh watches={[{ table: 'salary_payments' }]} />
    </div>
  )
}