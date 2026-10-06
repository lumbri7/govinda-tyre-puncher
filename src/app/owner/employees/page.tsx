import Link from 'next/link'
import type { Metadata } from 'next'

import { AddEmployeeForm } from '@/app/owner/employees/add-employee-form'
import { Badge, Card, EmptyState, LoadError, PageTitle, SectionTitle } from '@/components/ui'
import { formatDate, todayISO } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Staff' }

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireOwner()
  const params = await searchParams
  const adding = params.add === '1'

  const supabase = await createClient()
  const [{ data: employees, error }, { data: pending }] = await Promise.all([
    supabase
      .from('employees')
      .select('id, user_id, monthly_salary, is_active, joined_at')
      .eq('business_id', session.businessId)
      .order('is_active', { ascending: false }),
    // Salary the owner has recorded but the employee has not accepted yet. Shown
    // on the staff list so the shop can chase the acknowledgement instead of
    // forgetting about it.
    supabase
      .from('salary_payments')
      .select('employee_id')
      .eq('status', 'pending'),
  ])

  const list = employees ?? []
  const pendingByEmployee = new Map<string, number>()
  for (const payment of pending ?? []) {
    pendingByEmployee.set(payment.employee_id, (pendingByEmployee.get(payment.employee_id) ?? 0) + 1)
  }
  const pendingTotal = pendingByEmployee.size

  const userIds = list.map((employee) => employee.user_id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]))
  const activeCount = list.filter((employee) => employee.is_active).length

  return (
    <div className="space-y-4">
      <PageTitle
        title="Staff"
        subtitle={`${activeCount} active · ${list.length - activeCount} disabled`}
        action={
          <Link
            href={adding ? '/owner/employees' : '/owner/employees?add=1'}
            className="inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white no-underline"
          >
            {adding ? 'Close' : '+ Add'}
          </Link>
        }
      />

      {adding ? <AddEmployeeForm /> : null}

      {error ? (
        <LoadError title="Could not load the staff list" message={error.message} />
      ) : list.length === 0 ? (
        <EmptyState
          title="No employees yet"
          description="Add your first employee so they can create bills and accept salary payments."
        />
      ) : (
        <section className="space-y-2">
          <SectionTitle>Employees</SectionTitle>
          <ul className="space-y-2">
            {list.map((employee) => {
              const profile = byId.get(employee.user_id)
              const pendingCount = pendingByEmployee.get(employee.id) ?? 0
              return (
                <li key={employee.id}>
                  <Link
                    href={`/owner/employees/${employee.id}`}
                    className="flex items-center gap-3 rounded-2xl bg-white p-3.5 no-underline shadow-sm ring-1 ring-ink-200/70"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                        <span className="truncate">{profile?.full_name ?? 'Unknown'}</span>
                        {employee.is_active ? null : <Badge tone="bad">Disabled</Badge>}
                        {pendingCount > 0 ? (
                          <Badge tone="cash">
                            {pendingCount === 1 ? '1 salary unaccepted' : `${pendingCount} salaries unaccepted`}
                          </Badge>
                        ) : null}
                      </p>
                      <p className="tabular text-xs text-ink-500">
                        {profile?.phone ?? 'No number'} · joined {formatDate(employee.joined_at, session.timezone)}
                      </p>
                    </div>
                    <p className="tabular shrink-0 text-sm font-semibold text-ink-900">
                      {formatRupees(numericToPaise(employee.monthly_salary))}
                      <span className="block text-right text-xs font-normal text-ink-500">per month</span>
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <Card className="bg-ink-50">
        <p className="text-sm text-ink-600">
          Employees sign in with their mobile number and the password you set. They can change it later
          from their own screen. Today in the shop: {todayISO(session.timezone)}.
        </p>
        {pendingTotal > 0 ? (
          <p className="mt-2 text-sm font-semibold text-ink-900">
            {pendingTotal === 1 ? '1 salary payment is' : `${pendingTotal} salary payments are`} still
            waiting for the employee to accept it.
          </p>
        ) : null}
      </Card>
    </div>
  )
}