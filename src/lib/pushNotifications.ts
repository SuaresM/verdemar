import { apiClient } from './apiClient'

export async function subscribeToPush(_userId: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  const registration = await navigator.serviceWorker.ready
  const existing = await registration.pushManager.getSubscription()
  if (existing) return // already subscribed

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapidKey) return

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  })

  await apiClient.post(`/push/subscribe`, { subscription: subscription.toJSON() })
}
