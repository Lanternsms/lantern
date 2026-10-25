'use client'

import { useEffect } from 'react'
import { saveSubscription } from '@/app/dashboard/notifications/actions'

function getDeviceLabel(): string {
  const ua = navigator.userAgent
  let browser = 'Browser'
  let os = 'Device'

  if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome'
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari'
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox'
  else if (/edg/i.test(ua)) browser = 'Edge'

  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS'
  else if (/android/i.test(ua)) os = 'Android'
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS'
  else if (/windows/i.test(ua)) os = 'Windows'
  else if (/linux/i.test(ua)) os = 'Linux'

  return `${browser} on ${os}`
}

function bufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return ''
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export function PushSync() {
  useEffect(() => {
    async function syncExistingSubscription() {
      try {
        if (
          typeof window === 'undefined' ||
          !('serviceWorker' in navigator) ||
          !('PushManager' in window) ||
          !('Notification' in window)
        ) {
          return
        }

        // Never prompt: strictly when already granted
        if (Notification.permission !== 'granted') {
          return
        }

        // Throttled to once per session
        try {
          if (sessionStorage.getItem('push_synced') === 'true') {
            return
          }
        } catch {
          // Ignore sessionStorage error
        }

        const registration = await navigator.serviceWorker.getRegistration()
        if (!registration?.pushManager) return

        const sub = await registration.pushManager.getSubscription()

        if (!sub) return

        const p256dhKey = sub.getKey('p256dh')
        const authKey = sub.getKey('auth')

        if (!p256dhKey || !authKey) return

        const p256dh = bufferToBase64(p256dhKey)
        const auth = bufferToBase64(authKey)

        await saveSubscription({
          endpoint: sub.endpoint,
          keys: { p256dh, auth },
          deviceLabel: getDeviceLabel(),
        })

        try {
          sessionStorage.setItem('push_synced', 'true')
        } catch {
          // Ignore sessionStorage error
        }
      } catch (err) {
        // Silently swallow sync errors
        console.debug('PushSync silent check completed:', err)
      }
    }

    syncExistingSubscription()
  }, [])

  return null
}
