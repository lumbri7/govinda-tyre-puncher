import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { AppShell } from '@/components/app-shell'
import { IconBill, IconHome, IconPlus, IconRupee, IconUser } from '@/components/icons'
import { NotificationBell } from '@/components/notification-bell'
import { requireEmployee } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Employee' }

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const session = await requireEmployee()
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

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
        <NotificationBell
          userId={session.userId}
          unread={count ?? 0}
          href="/employee/alerts"
        />
      }
    >
      {children}
    </AppShell>
  )
}