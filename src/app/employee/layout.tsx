import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { IconBill, IconHome, IconPlus, IconRupee, IconUser } from '@/components/icons'
import { NotificationBell } from '@/components/notification-bell'
import { NotificationsUnread } from '@/components/notifications-unread'
import { requireEmployee } from '@/lib/auth'
import { Suspense } from 'react'

export const metadata: Metadata = { title: 'Employee' }

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await requireEmployee()
  // unread count deferred to Suspense to avoid blocking layout rendering

  const nav = [
    { href: '/employee', label: 'Home', icon: <IconHome />, exact: true },
    { href: '/employee/bill/new', label: 'New Bill', icon: <IconPlus /> },
    { href: '/employee/bills', label: 'My Bills', icon: <IconBill /> },
    { href: '/employee/salary', label: 'Salary', icon: <IconRupee /> },
    { href: '/employee/me', label: 'Me', icon: <IconUser /> },
  ]

  return (
    <AppShell
      shopName={session.businessName}
      title="Employee"
      nav={nav}
      headerAction={
        <NotificationBell userId={session.userId} unread={0} href="/employee/alerts">
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