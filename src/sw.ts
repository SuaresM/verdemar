/// <reference lib="WebWorker" />
import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { createHandlerBoundToURL } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// Take over immediately on new deploys so users don't stay on stale bundles.
self.skipWaiting()
clientsClaim()

// Inject precache manifest (replaced at build time by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Auth endpoints must never be cached
const authDenylist = [/^\/auth\//, /supabase\.co/]

// SPA fallback — navigate to index.html for all non-auth routes
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: authDenylist,
  }),
)

// Product images: StaleWhileRevalidate so new uploads still refresh in background
registerRoute(
  ({ url }) => url.href.includes('supabase.co/storage'),
  new StaleWhileRevalidate({
    cacheName: 'supabase-images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 })],
  }),
)

// Google Fonts
registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  }),
)

// ---- Push Notifications ----
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json() as { title: string; body: string; url?: string }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url ?? '/supplier/orders' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data?.url as string) ?? '/supplier/orders'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const existing = clientList.find((c) => c.url.includes(url))
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      }),
  )
})
