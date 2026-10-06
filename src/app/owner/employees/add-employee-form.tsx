'use client'

import { useActionState, useState } from 'react'

import { createEmployee } from '@/app/owner/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { PasswordField } from '@/components/password-field'
import { SubmitButton } from '@/components/submit-button'
import { Card, SectionTitle } from '@/components/ui'
import { idleState } from '@/lib/action-state'
import { todayISO } from '@/lib/dates'

export function AddEmployeeForm() {
  const [state, action] = useActionState(createEmployee, idleState)
  const [joinedAt, setJoinedAt] = useState(() => todayISO())

  return (
    <Card className="space-y-4">
      <SectionTitle>Add an employee</SectionTitle>

      <form action={action} className="space-y-4">
        <FormMessage
          error={state.status === 'error' ? state.message : undefined}
          success={state.status === 'success' ? state.message : undefined}
          className={state.status === 'success' ? 'font-mono text-xs' : undefined}
        />

        <Field label="Full name" htmlFor="employee-name" error={state.errors?.fullName}>
          <Input id="employee-name" name="fullName" autoComplete="name" required invalid={Boolean(state.errors?.fullName)} />
        </Field>

        <Field label="Mobile number" htmlFor="employee-phone" error={state.errors?.phone}>
          <div className="flex">
            <span className="flex min-h-14 items-center rounded-l-xl bg-ink-100 px-3 text-sm font-semibold text-ink-600">
              +91
            </span>
            <Input
              id="employee-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={16}
              placeholder="98765 43210"
              className="tabular rounded-l-none"
              required
              invalid={Boolean(state.errors?.phone)}
            />
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monthly salary" htmlFor="employee-salary" error={state.errors?.monthlySalary}>
            <Input
              id="employee-salary"
              name="monthlySalary"
              inputMode="decimal"
              placeholder="12000"
              className="tabular"
              required
              invalid={Boolean(state.errors?.monthlySalary)}
            />
          </Field>

          <Field label="Joined on" htmlFor="employee-joined" error={state.errors?.joinedAt}>
            <Input
              id="employee-joined"
              name="joinedAt"
              type="date"
              value={joinedAt}
              onChange={(event) => setJoinedAt(event.target.value)}
              max={todayISO()}
              required
              invalid={Boolean(state.errors?.joinedAt)}
            />
          </Field>
        </div>

        <PasswordField
          id="employee-password"
          name="password"
          label="Login password"
          error={state.errors?.password}
          hint="The employee signs in with this. At least 8 characters, with a letter and a number. Write it down before you continue — nobody can read it back later."
        />

        <PasswordField
          id="employee-confirm"
          name="confirmPassword"
          label="Confirm password"
          error={state.errors?.confirmPassword}
        />

        <SubmitButton pendingLabel="Adding...">Add employee</SubmitButton>
      </form>
    </Card>
  )
}