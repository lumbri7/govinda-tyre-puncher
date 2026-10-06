'use client'

import { useEffect } from 'react'

/**
 * Registers the offline service worker.
 *
 * The worker only caches static assets (icons, CSS, JS chunks) and never
 * authenticated HTML or API responses, so a bill left open on a shared shop
 * phone cannot leak through the cache.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Offline support is a bonus: a failed registration must never break
        // the app.
      })
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}