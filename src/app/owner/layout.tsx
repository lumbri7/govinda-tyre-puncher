import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { IconBill, IconChart, IconHome, IconRupee, IconStaff } from '@/components/icons'
import { NotificationBell } from '@/components/notification-bell'
import { NotificationsUnread } from '@/components/notifications-unread'
import { requireOwner } from '@/lib/auth'
import { Suspense } from 'react'

export const metadata: Metadata = { title: 'Owner' }

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const session = await requireOwner()
  const nav = [
    { href: '/owner', label: 'Dashboard', icon: <IconHome />, exact: true },
    { href: '/owner/bills', label: 'Bills', icon: <IconBill /> },
    { href: '/owner/reports', label: 'Reports', icon: <IconChart /> },
    { href: '/owner/employees', label: 'Staff', icon: <IconStaff /> },
    { href: '/owner/salary', label: 'Salary', icon: <IconRupee /> },
  ]

  return (
    <AppShell
      shopName={session.businessName}
      title="Shop owner"
      nav={nav}
      headerAction={
          <NotificationBell
            userId={session.userId}
            unread={0}
            href="/owner/alerts"
          >
            <Suspense fallback={0}>
              <NotificationsUnread />
            </Suspense>
          </NotificationBell>
      }
    >
      {children}
    </AppShell>
  )
}