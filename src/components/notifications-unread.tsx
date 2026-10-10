import { createClient } from '@/lib/supabase/server'

/**
 * Fetches the unread notification count. Wrapped in Suspense so the app shell
 * can stream while layouts that need this data no longer block every navigation.
 */
export async function NotificationsUnread() {
  const supabase = await createClient()
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)
  return <>{count ?? 0}</>
}
