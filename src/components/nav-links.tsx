'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cx } from '@/components/ui'

export type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  /** Match nested pages too, e.g. /owner/bills/123. */
  exact?: boolean
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: 'bar' | 'list' }) {
  const pathname = usePathname()

  if (variant === 'list') {
    return (
      <nav className="space-y-1">
        {items.map((item) => {
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold no-underline transition-colors',
                active ? 'bg-brand-50 text-brand-800' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              <span className="shrink-0">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>
    )
  }

  return (
    <nav className="safe-bottom no-print fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/95 pt-1 backdrop-blur md:hidden">
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const active = isActive(pathname, item)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.6875rem] font-semibold no-underline',
                  active ? 'text-brand-700' : 'text-ink-500',
                )}
              >
                <span className={cx(active && 'text-brand-700')}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}