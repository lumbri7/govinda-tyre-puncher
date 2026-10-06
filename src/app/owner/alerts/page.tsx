import type { Metadata } from 'next'

import { NotificationList } from '@/components/notification-list'
import { requireOwner } from '@/lib/auth'

export const metadata: Metadata = { title: 'Alerts' }

export default async function AlertsPage() {
  const session = await requireOwner()
  return <NotificationList session={session} />
}
