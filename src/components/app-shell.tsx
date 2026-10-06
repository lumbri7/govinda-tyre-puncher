import type { ReactNode } from 'react'

import { BrandMark } from '@/components/brand'
import { NavLinks, type NavItem } from '@/components/nav-links'

export type ShellProps = {
  shopName: string
  title: string
  nav: NavItem[]
  headerAction?: ReactNode
  children: ReactNode
}

/**
 * App chrome: a sticky header, a sidebar on wide screens and a bottom tab bar on
 * a phone. Pages must not add their own outer padding.
 */
export function AppShell({ shopName, title, nav, headerAction, children }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top no-print sticky top-0 z-30 border-b border-ink-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <BrandMark className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink-950">{title}</p>
            <p className="truncate text-xs text-ink-500">{shopName}</p>
          </div>
          {headerAction}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 gap-6 px-4 py-4 md:py-6">
        <aside className="no-print hidden w-56 shrink-0 md:block">
          <div className="sticky top-24 space-y-4">
            <NavLinks items={nav} variant="list" />
            <ShopFooter />
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 md:pb-4">{children}</main>
      </div>

      <NavLinks items={nav} variant="bar" />
    </div>
  )
}

export function ShopFooter() {
  return (
    <p className="px-3 text-xs text-ink-400">
      Govinda Tyre Puncture
      <br />
      Install this page on your phone for one tap access.
    </p>
  )
}