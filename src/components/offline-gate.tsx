'use client'

import { useSyncExternalStore } from 'react'

import { ReloadButton } from '@/components/reload-button'

/**
 * A shop is its phone's weakest link: an owner out on a job has no wifi and
 * sometimes no signal. Instead of a spinning page, a lost connection gets one
 * clear screen saying the app is offline and the bill in progress is safe in
 * the device. The moment a connection returns (or the page is reloaded), the
 * app continues exactly where it was.
 */
function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

const onBrowser = () => navigator.onLine
const onServer = () => true

export function OfflineGate({ children }: { children: React.ReactNode }) {
  const online = useSyncExternalStore(subscribe, onBrowser, onServer)

  if (online) return <>{children}</>

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="size-10 rounded-full bg-ink-100 text-2xl" aria-hidden="true">
        ⚠
      </p>
      <h1 className="text-xl font-bold text-ink-950">You are offline</h1>
      <p className="max-w-sm text-sm text-ink-600">
        A bill you are in the middle of stays on this device. Reconnect to the internet to continue.
      </p>
      <ReloadButton label="Try again" />
    </main>
  )
}