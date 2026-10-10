'use client'

import Link from 'next/link'

import { IconBell } from '@/components/icons'
import { RealtimeRefresh } from '@/components/realtime-refresh'

export function NotificationBell({
  userId,
  unread,
  href,
  children,
}: {
  userId: string
  unread: number
  href: string
  children?: React.ReactNode
}) {
  return (
    <>
      <Link
        href={href}
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
        className="relative flex size-11 items-center justify-center rounded-xl text-ink-700 hover:bg-ink-100"
      >
        <IconBell />
        <span className="absolute top-1 right-0.5 flex min-w-5 items-center justify-center rounded-full bg-bad-600 px-1 text-[0.625rem] font-bold text-white">
          {children ?? (unread > 9 ? '9+' : unread)}
        </span>
      </Link>
      <RealtimeRefresh
        watches={[{ table: 'notifications', filter: `user_id=eq.${userId}` }]}
      />
    </>
  )
}