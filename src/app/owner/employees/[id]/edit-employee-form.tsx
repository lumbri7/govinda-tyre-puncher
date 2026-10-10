'use client'

import { useActionState } from 'react'

import { updateEmployee } from '@/app/owner/actions'
import { AvatarPicker } from '@/components/avatar'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { Card, SectionTitle } from '@/components/ui'
import { idleState } from '@/lib/action-state'
import { formatPaise, formatRupees, numericToPaise } from '@/lib/money'
import { todayISO } from '@/lib/dates'

export function EditEmployeeForm({
  employee,
  avatarAvailable,
}: {
  employee: {
    id: string
    fullName: string
    phone: string
    monthlySalary: number
    joinedAt: string
    avatar: string | null
  }
  avatarAvailable: boolean
}) {
  const [state, action] = useActionState(updateEmployee, idleState)

  return (
    <Card className="space-y-4">
      <SectionTitle>Details</SectionTitle>

      <form action={action} className="space-y-4">
        <input type="hidden" name="employeeId" value={employee.id} />
        <FormMessage
          error={state.status === 'error' ? state.message : undefined}
          success={state.status === 'success' ? state.message : undefined}
        />

        <Field label="Full name" htmlFor="edit-name" error={state.errors?.fullName}>
          <Input id="edit-name" name="fullName" defaultValue={employee.fullName} required />
        </Field>

        <Field label="Mobile number" htmlFor="edit-phone" error={state.errors?.phone}>
          <div className="flex">
            <span className="flex min-h-14 items-center rounded-l-xl bg-ink-100 px-3 text-sm font-semibold text-ink-600">
              +91
            </span>
            <Input
              id="edit-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              defaultValue={employee.phone.replace(/^\+91/, '')}
              maxLength={16}
              className="tabular rounded-l-none"
              required
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Monthly salary"
            htmlFor="edit-salary"
            error={state.errors?.monthlySalary}
            hint={`Currently ${formatRupees(numericToPaise(employee.monthlySalary))}`}
          >
            <Input
              id="edit-salary"
              name="monthlySalary"
              inputMode="decimal"
              defaultValue={formatPaise(numericToPaise(employee.monthlySalary))}
              className="tabular"
              required
            />
          </Field>

          <Field label="Joined on" htmlFor="edit-joined" error={state.errors?.joinedAt}>
            <Input id="edit-joined" name="joinedAt" type="date" defaultValue={employee.joinedAt} max={todayISO()} required />
          </Field>
        </div>

        {avatarAvailable ? <AvatarPicker name="avatar" value={employee.avatar ?? ''} /> : null}

        <SubmitButton pendingLabel="Saving...">Save changes</SubmitButton>
      </form>
    </Card>
  )
}