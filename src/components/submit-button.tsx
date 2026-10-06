'use client'

import { useFormStatus } from 'react-dom'

import { Button, cx } from '@/components/ui'

/** Button that shows a spinner while the enclosing form action is running. */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant = 'primary',
  size = 'lg',
  full = true,
  disabled,
  name,
  value,
  title,
}: {
  children: React.ReactNode
  pendingLabel?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'success'
  size?: 'lg' | 'md' | 'sm'
  full?: boolean
  disabled?: boolean
  name?: string
  value?: string
  title?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      full={full}
      disabled={pending || disabled}
      name={name}
      value={value}
      title={title}
      aria-busy={pending}
      className={cx(className)}
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel ?? 'Please wait...'}
        </>
      ) : (
        children
      )}
    </Button>
  )
}

function Spinner() {
  return (
    <svg
      className="size-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}