import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cx } from '@/components/ui'

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-700">
        {label}
      </label>
      {children}
      {error ? (
        // Announced, not just drawn: the person filling this in may be looking
        // at the keyboard, not at the message under the field.
        <p role="alert" className="text-sm font-medium text-bad-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-xl border-0 bg-white px-3.5 text-base text-ink-900 shadow-sm ring-1 ring-ink-200 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-600 focus:outline-none disabled:bg-ink-50 disabled:text-ink-400'

export function Input({
  className,
  invalid,
  ...props
}: ComponentPropsWithoutRef<'input'> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'min-h-14', invalid && 'ring-bad-600', className)}
      {...props}
    />
  )
}

export function Select({
  className,
  invalid,
  children,
  ...props
}: ComponentPropsWithoutRef<'select'> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'min-h-14 appearance-none pr-10', invalid && 'ring-bad-600', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%23677695'%3E%3Cpath fill-rule='evenodd' d='M5.2 7.6a1 1 0 011.4 0L10 11.2l3.4-3.6a1 1 0 111.4 1.4l-4.1 4.3a1 1 0 01-1.4 0L5.2 9a1 1 0 010-1.4z' clip-rule='evenodd'/%3E%3C/svg%3E\")",
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        backgroundSize: '1.25rem',
      }}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({
  className,
  invalid,
  ...props
}: ComponentPropsWithoutRef<'textarea'> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cx(CONTROL, 'py-3', invalid && 'ring-bad-600', className)}
      {...props}
    />
  )
}

export function FormMessage({
  error,
  success,
  className,
}: {
  error?: string
  success?: string
  className?: string
}) {
  if (!error && !success) return null
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={cx(
        'rounded-xl px-3 py-2.5 text-sm font-medium',
        error ? 'bg-bad-50 text-bad-700' : 'bg-good-50 text-good-700',
        className,
      )}
    >
      {error ?? success}
    </div>
  )
}