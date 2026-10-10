import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { ReloadButton } from '@/components/reload-button'

/** Small helper so a class list can be conditional without a dependency. */
export function cx(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ')
}

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-ink-300',
  secondary:
    'bg-white text-ink-800 ring-1 ring-ink-200 shadow-sm hover:bg-ink-50 active:bg-ink-100 disabled:text-ink-400',
  soft: 'bg-brand-50 text-brand-800 hover:bg-brand-100 active:bg-brand-200 disabled:text-brand-300',
  ghost: 'text-ink-600 hover:bg-ink-100 active:bg-ink-200 disabled:text-ink-300',
  danger: 'bg-bad-600 text-white shadow-sm hover:bg-bad-700 active:bg-bad-700 disabled:bg-ink-300',
  success:
    'bg-good-600 text-white shadow-sm hover:bg-good-700 active:bg-good-700 disabled:bg-ink-300',
} as const

const SIZES = {
  lg: 'min-h-14 px-5 text-base',
  md: 'min-h-12 px-4 text-sm',
  sm: 'min-h-10 px-3 text-sm',
} as const

type ButtonProps = {
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  full?: boolean
} & ComponentPropsWithoutRef<'button'>

export function Button({
  variant = 'primary',
  size = 'lg',
  full = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        'disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...props}
    />
  )
}

export function LinkButton({
  variant = 'primary',
  size = 'lg',
  full = false,
  className,
  children,
  ...props
}: Omit<ComponentPropsWithoutRef<'a'>, 'children'> & {
  children: ReactNode
  href: string
  variant?: keyof typeof VARIANTS
  size?: keyof typeof SIZES
  full?: boolean
}) {
  return (
    <a
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors no-underline',
        VARIANTS[variant],
        SIZES[size],
        full && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200/70', className)}>
      {children}
    </div>
  )
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-950 sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 text-sm font-semibold tracking-wide text-ink-500 uppercase">{children}</h2>
  )
}

const BADGE_TONES = {
  neutral: 'bg-ink-100 text-ink-700',
  brand: 'bg-brand-50 text-brand-800',
  good: 'bg-good-50 text-good-700',
  bad: 'bg-bad-50 text-bad-700',
  cash: 'bg-cash-50 text-cash-700',
} as const

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: keyof typeof BADGE_TONES
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'brand' | 'good' | 'cash'
}) {
  const tones = {
    neutral: 'text-ink-950',
    brand: 'text-brand-700',
    good: 'text-good-700',
    cash: 'text-cash-700',
  }
  return (
    <div className="min-w-0 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-200/70">
      <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</p>
      {/* Fluid size keeps a full lakh value inside its half-width card on a
          320px screen, and `overflow-wrap:anywhere` is the safety net for
          values too wide for the column even then. */}
      <p
        className={cx(
          'tabular mt-1 text-[clamp(1.125rem,5vw,1.5rem)] font-bold [overflow-wrap:anywhere] sm:text-2xl',
          tones[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 px-4 py-10 text-center">
      <p className="text-base font-semibold text-ink-800">{title}</p>
      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

/**
 * Shown when the database did not answer.
 *
 * Every list in this app has to say "nothing here" and "we could not look" as
 * different things: an owner who sees an empty salary list after a failed
 * query would record the same payment twice.
 */
export function LoadError({
  message,
  title = 'Could not load this right now',
  retry = false,
}: {
  message?: string | null
  title?: string
  retry?: boolean
}) {
  return (
    <Card className="ring-bad-200">
      <p className="text-sm font-semibold text-bad-700">{title}</p>
      <p className="mt-1 text-sm text-ink-600">
        {message ?? 'The database did not answer. Check the connection and try again.'}
      </p>
      {retry ? (
        <div className="mt-3 flex justify-start">
          <ReloadButton />
        </div>
      ) : null}
    </Card>
  )
}

/** Horizontal scroll wrapper for wide tables on a phone. */
export function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="inline-block min-w-full align-middle">{children}</div>
    </div>
  )
}
