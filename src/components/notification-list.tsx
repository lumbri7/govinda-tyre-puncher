import { markAllNotificationsRead, markNotificationRead } from '@/app/shared-actions'
import { RealtimeRefresh } from '@/components/realtime-refresh'
import { SubmitButton } from '@/components/submit-button'
import { Badge, EmptyState, PageTitle } from '@/components/ui'
import { timeAgo } from '@/lib/dates'
import type { Session } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/** Shared alerts screen: an owner and an employee see the same list, scoped by
 * RLS to their own notifications. */
export async function NotificationList({ session }: { session: Session }) {
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, message, related_id, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const list = notifications ?? []
  const unread = list.filter((notification) => !notification.is_read)
  const salaryHref = session.role === 'owner' ? '/owner/salary' : '/employee/salary'

  return (
    <div className="space-y-4">
      <PageTitle
        title="Alerts"
        subtitle={unread.length > 0 ? `${unread.length} unread` : 'All caught up'}
        action={
          unread.length > 0 ? (
            <form action={markAllNotificationsRead}>
              <SubmitButton size="sm" variant="secondary" pendingLabel="...">
                Mark all read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {list.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description={
            session.role === 'owner'
              ? 'Salary acceptances and cancellations will show up here.'
              : 'Salary payments recorded by the owner will show up here.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {list.map((notification) => (
            <li
              key={notification.id}
              className={
                notification.is_read
                  ? 'rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-ink-200/70'
                  : 'rounded-2xl bg-brand-50 p-3.5 shadow-sm ring-1 ring-brand-200'
              }
            >
              <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                {notification.title}
                {notification.is_read ? null : <Badge tone="brand">New</Badge>}
              </p>
              <p className="mt-0.5 text-sm text-ink-700">{notification.message}</p>
              <p className="mt-1 text-xs text-ink-500">{timeAgo(notification.created_at)}</p>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {notification.type.startsWith('salary_payment') ? (
                  <a
                    href={salaryHref}
                    className="inline-flex min-h-10 items-center rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white no-underline"
                  >
                    {session.role === 'owner' ? 'Open salary' : 'Review'}
                  </a>
                ) : null}
                {notification.is_read ? null : (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <SubmitButton size="sm" variant="secondary" pendingLabel="...">
                      Mark read
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <RealtimeRefresh watches={[{ table: 'notifications', filter: `user_id=eq.${session.userId}` }]} />
    </div>
  )
}