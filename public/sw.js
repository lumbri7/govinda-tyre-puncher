/*
 * Govinda Tyre Puncture service worker.
 *
 * Deliberately conservative: only static assets are cached. Authenticated HTML
 * and anything from the Supabase API are never stored, so a bill left open on a
 * shared shop phone cannot be read from the cache by the next person.
 */

const VERSION = 'gtp-v1'
const STATIC_CACHE = `${VERSION}-static`
const OFFLINE_URL = '/offline.html'

const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never serve or store anything authenticated.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/_next/webpack-hmr') ||
    request.headers.get('accept')?.includes('text/html')
  ) {
    if (request.mode === 'navigate') {
      // Show the offline page when the network is gone, otherwise let the page
      // load normally (it needs cookies and a live session).
      event.respondWith(
        fetch(request).catch(() => caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE })),
      )
    }
    return
  }

  if (!url.pathname.startsWith('/_next/static/') && !url.pathname.startsWith('/icons/')) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone()
            void caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        }),
    ),
  )
})
