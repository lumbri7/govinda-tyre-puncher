'use client'

import { useState } from 'react'

import { Field, Input } from '@/components/form'
import { cx } from '@/components/ui'

/**
 * A password input with a show/hide toggle.
 *
 * The shop owner types an employee's password and then reads it back over the
 * counter, so being able to check what was typed matters more here than hiding
 * it by default.
 */
export function PasswordField({
  id,
  name,
  label,
  error,
  hint,
  autoComplete = 'new-password',
  className,
}: {
  id: string
  name: string
  label: string
  error?: string
  hint?: string
  autoComplete?: string
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength={8}
          maxLength={72}
          required
          invalid={Boolean(error)}
          className={cx('pr-20', className)}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-2 text-sm font-semibold text-brand-700"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </Field>
  )
}