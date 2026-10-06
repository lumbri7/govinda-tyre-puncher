'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { signInEmployee, signInOwner } from '@/app/(auth)/actions'
import { Field, FormMessage, Input } from '@/components/form'
import { SubmitButton } from '@/components/submit-button'
import { cx } from '@/components/ui'
import { idleState } from '@/lib/action-state'

type Tab = 'owner' | 'employee'

export function LoginForm({ notice }: { notice?: string }) {
  const [tab, setTab] = useState<Tab>('owner')

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Login type" className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
        {(['owner', 'employee'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cx(
              'min-h-11 rounded-lg text-sm font-semibold transition-colors',
              tab === value ? 'bg-white text-ink-950 shadow-sm' : 'text-ink-600',
            )}
          >
            {value === 'owner' ? 'Shop owner' : 'Employee'}
          </button>
        ))}
      </div>

      {notice ? <FormMessage success={notice} /> : null}

      {tab === 'owner' ? <OwnerForm /> : <EmployeeForm />}
    </div>
  )
}

function OwnerForm() {
  const [state, action] = useActionState(signInOwner, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.status === 'error' ? state.message : undefined} />

      <Field label="Email" htmlFor="email" error={state.errors?.email}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          placeholder="owner@example.com"
          required
          invalid={Boolean(state.errors?.email)}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        error={state.errors?.password}
        hint=" "
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-brand-700 underline">
          Forgot password?
        </Link>
      </div>

      <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>
    </form>
  )
}

function EmployeeForm() {
  const [state, action] = useActionState(signInEmployee, idleState)

  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state.status === 'error' ? state.message : undefined} />

      <Field label="Mobile number" htmlFor="phone" error={state.errors?.phone}>
        <div className="flex">
          <span className="flex min-h-14 items-center rounded-l-xl bg-ink-100 px-3 text-sm font-semibold text-ink-600">
            +91
          </span>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="98765 43210"
            className="rounded-l-none tabular"
            maxLength={16}
            required
            invalid={Boolean(state.errors?.phone)}
          />
        </div>
      </Field>

      <Field
        label="Password"
        htmlFor="employee-password"
        error={state.errors?.password}
        hint="Use the password the shop owner gave you. You can change it later."
      >
        <Input
          id="employee-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          invalid={Boolean(state.errors?.password)}
        />
      </Field>

      <SubmitButton pendingLabel="Signing in...">Sign in</SubmitButton>
    </form>
  )
}