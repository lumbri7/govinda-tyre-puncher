'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { createClient } from '@/lib/supabase/client'

type TableWatch = {
  table: string
  /** PostgREST filter, e.g. `user_id=eq.<uuid>`. */
  filter?: string
}

/**
 * Every effect run gets its own topic. Two of these can watch the same table on
 * one page (the header bell and the alerts screen both follow notifications),
 * and `client.channel(name)` hands back the channel it already has for a topic,
 * so a shared name would register handlers on a subscribed channel and Supabase
 * throws "Cannot add 'postgres_changes' callbacks ... after 'subscribe()'".
 */
let subscriptionCount = 0

/**
 * Refreshes the current server rendered page when a watched table changes.
 *
 * Row level security still applies: the realtime server sends this client the
 * session JWT, and Postgres only streams rows that RLS lets the user read, so an
 * employee is never pushed another employee's salary row.
 */
export function RealtimeRefresh({ watches, debounceMs = 400 }: { watches: TableWatch[]; debounceMs?: number }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // `watches` is a fresh array on every parent render, and a `router.refresh()`
  // re-renders this component. Keying the effect off the content instead of the
  // array identity is what keeps one live subscription per set of watches
  // rather than tearing it down after every refresh the app itself triggers.
  const watchKey = useMemo(
    () => JSON.stringify(watches.map((watch) => [watch.table, watch.filter ?? ''])),
    [watches],
  )

  useEffect(() => {
    const parsed = JSON.parse(watchKey) as [string, string][]
    if (parsed.length === 0) return

    const supabase = createClient()
    subscriptionCount += 1
    const channel = supabase.channel(
      `realtime:${subscriptionCount}:${parsed.map(([table]) => table).join(',')}`,
    )

    for (const [table, filter] of parsed) {
      // Lifecycle order matters: every listener is registered before subscribe().
      channel.on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- supabase-js types this callback loosely
        'postgres_changes' as any,
        { event: '*', schema: 'public', table, filter: filter || undefined },
        () => {
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => router.refresh(), debounceMs)
        },
      )
    }

    channel.subscribe()

    return () => {
      if (timer.current) clearTimeout(timer.current)
      void supabase.removeChannel(channel)
    }
  }, [watchKey, debounceMs, router])

  return null
}