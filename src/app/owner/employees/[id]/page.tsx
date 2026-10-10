import Link from 'next/link'
import type { Metadata } from 'next'

import { EditEmployeeForm } from '@/app/owner/employees/[id]/edit-employee-form'
import { EmployeeActiveForm } from '@/app/owner/employees/[id]/employee-active-form'
import { ResetPasswordForm } from '@/app/owner/employees/[id]/reset-password-form'
import { Avatar } from '@/components/avatar'
import { Badge, Card, EmptyState, PageTitle, SectionTitle } from '@/components/ui'
import { formatDate } from '@/lib/dates'
import { formatRupees, numericToPaise } from '@/lib/money'
import { readProfiles } from '@/lib/avatars'
import { requireOwner } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Employee' }

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireOwner()
  const { id } = await params
  const supabase = await createClient()

  const { data: employee } = await supabase
    .from('employees')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!employee) {
    return (
      <div className="space-y-4">
        <Link href="/owner/employees" className="text-sm font-semibold text-brand-700">
          &larr; Staff
        </Link>
        <EmptyState title="Employee not found" />
      </div>
    )
  }

  const [{ profiles, avatarAvailable }, { data: payments }, { count: billCount }] = await Promise.all([
    readProfiles(supabase, [employee.user_id], 'full_name, phone'),
    supabase
      .from('salary_payments')
      .select('id, amount, payment_date, status, note')
      .eq('employee_id', employee.id)
      .order('payment_date', { ascending: false })
      .limit(12),
    supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', employee.user_id),
  ])

  const profile = profiles[0] ?? null

  return (
    <div className="space-y-5">
      <Link href="/owner/employees" className="text-sm font-semibold text-brand-700">
        &larr; Staff
      </Link>

      <div className="flex items-center gap-3">
        <Avatar name={profile?.full_name} avatar={profile?.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <PageTitle
            title={profile?.full_name ?? 'Employee'}
            subtitle={`${formatRupees(numericToPaise(employee.monthly_salary))} per month · joined ${formatDate(employee.joined_at, session.timezone)}`}
            action={employee.is_active ? <Badge tone="good">Active</Badge> : <Badge tone="bad">Disabled</Badge>}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Bills created</p>
          <p className="tabular text-2xl font-bold text-ink-950">{billCount ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">Login</p>
          <p className="tabular truncate text-sm font-semibold text-ink-950">{profile?.phone ?? '—'}</p>
        </Card>
      </div>

      <EditEmployeeForm
        avatarAvailable={avatarAvailable}
        employee={{
          id: employee.id,
          fullName: profile?.full_name ?? '',
          phone: profile?.phone ?? '',
          monthlySalary: employee.monthly_salary,
          joinedAt: employee.joined_at,
          avatar: profile?.avatar ?? null,
        }}
      />

      <section className="space-y-2">
        <SectionTitle>Recent salary payments</SectionTitle>
        {(payments ?? []).length === 0 ? (
          <EmptyState title="No salary payments recorded yet" />
        ) : (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-200/70">
            {(payments ?? []).map((payment) => (
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
                <Badge tone={payment.status === 'confirmed' ? 'good' : payment.status === 'pending' ? 'cash' : 'neutral'}>
                  {payment.status === 'confirmed'
                    ? 'Accepted'
                    : payment.status === 'pending'
                      ? 'Waiting'
                      : 'Cancelled'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <SectionTitle>Login access</SectionTitle>
        <div className="space-y-4">
          <ResetPasswordForm employeeId={employee.id} />

          <div className="space-y-2 border-t border-ink-100 pt-4">
            <EmployeeActiveForm
              employeeId={employee.id}
              employeeName={profile?.full_name ?? 'This employee'}
              isActive={employee.is_active}
            />
          </div>
        </div>
      </section>
    </div>
  )
}