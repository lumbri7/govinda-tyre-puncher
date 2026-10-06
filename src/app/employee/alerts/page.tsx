import type { Metadata } from 'next'

import { NotificationList } from '@/components/notification-list'
import { requireEmployee } from '@/lib/auth'

export const metadata: Metadata = { title: 'Alerts' }

export default async function AlertsPage() {
  const session = await requireEmployee()
  return <NotificationList session={session} />
}
