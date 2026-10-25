'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  Trash2,
  Send,
  Loader2,
  Info,
  Laptop,
} from 'lucide-react'
import {
  saveSubscription,
  removeSubscription,
  sendTestPush,
  type UserSubscriptionInfo,
} from '@/app/dashboard/notifications/actions'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
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

export function PushSettingsCard({
  existingSubscriptions = [],
}: {
  existingSubscriptions: UserSubscriptionInfo[]
}) {
  const [mounted, setMounted] = useState(false)
  const [supported, setSupported] = useState(true)
  const [isIOSWebTab, setIsIOSWebTab] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [isSubscribedOnDevice, setIsSubscribedOnDevice] = useState(false)
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [otherDevices, setOtherDevices] = useState<UserSubscriptionInfo[]>(existingSubscriptions)

  useEffect(() => {
    setMounted(true)

    // Check browser support
    const isPushSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    setSupported(isPushSupported)
    if (!isPushSupported) return

    // iOS check: iOS 16.4+ requires running as standalone installed PWA to enable push
    const ua = window.navigator.userAgent.toLowerCase()
    const isApple = /iphone|ipad|ipod/.test(ua)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)

    if (isApple && !isStandalone) {
      setIsIOSWebTab(true)
    }

    setPermission(Notification.permission)

    async function checkSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          setIsSubscribedOnDevice(true)
          setCurrentEndpoint(sub.endpoint)
        } else {
          setIsSubscribedOnDevice(false)
          setCurrentEndpoint(null)
        }
      } catch (err) {
        console.debug('Error checking push subscription:', err)
      }
    }

    checkSubscription()
  }, [])

  useEffect(() => {
    setOtherDevices(existingSubscriptions)
  }, [existingSubscriptions])

  if (!mounted) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 animate-pulse h-48" />
    )
  }

  // State 1: Unsupported browser
  if (!supported) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Push notifications unsupported</h3>
            <p className="text-xs text-text-secondary">
              Your current web browser does not support Web Push notifications.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // State 2: iOS not installed as standalone PWA
  if (isIOSWebTab) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">Install Lantern first on iOS</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Apple iOS requires Lantern to be added to your Home Screen before push alerts can be enabled.
            </p>
            <div className="mt-3 rounded-lg bg-surface-muted border border-border p-3 text-xs text-text-secondary space-y-1">
              <p className="font-medium text-text-primary">To enable on your iPhone / iPad:</p>
              <p>1. Tap the <strong>Share</strong> button in the Safari toolbar.</p>
              <p>2. Tap <strong>Add to Home Screen</strong>.</p>
              <p>3. Open Lantern from your home screen and return here to enable notifications.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Handle Enable Push
  async function handleEnablePush() {
    setIsLoading(true)
    setTestResult(null)

    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready

      const perm = await Notification.requestPermission()
      setPermission(perm)

      if (perm !== 'granted') {
        setIsLoading(false)
        return
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        throw new Error('VAPID public key not found in application configuration')
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })

      const p256dhKey = sub.getKey('p256dh')
      const authKey = sub.getKey('auth')

      if (!p256dhKey || !authKey) {
        throw new Error('Could not retrieve browser push encryption keys')
      }

      const res = await saveSubscription({
        endpoint: sub.endpoint,
        keys: {
          p256dh: bufferToBase64(p256dhKey),
          auth: bufferToBase64(authKey),
        },
        deviceLabel: getDeviceLabel(),
      })

      if (res.error) {
        throw new Error(res.error)
      }

      setIsSubscribedOnDevice(true)
      setCurrentEndpoint(sub.endpoint)
      try {
        sessionStorage.setItem('push_synced', 'true')
      } catch {
        // Ignore sessionStorage error
      }
    } catch (err: unknown) {
      console.error('Failed to enable push notifications:', err)
      alert((err as Error)?.message || 'Failed to enable notifications')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Turn Off on this device
  async function handleDisablePush() {
    setIsLoading(true)
    setTestResult(null)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const ep = sub.endpoint
        await sub.unsubscribe()
        await removeSubscription({ endpoint: ep })
      }
      setIsSubscribedOnDevice(false)
      setCurrentEndpoint(null)
      try {
        sessionStorage.removeItem('push_synced')
      } catch {
        // Ignore sessionStorage error
      }
    } catch (err: unknown) {
      console.error('Failed to turn off notifications:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Send Test Notification
  async function handleSendTest() {
    setIsLoading(true)
    setTestResult(null)

    try {
      const res = await sendTestPush()
      if (res.error) {
        setTestResult(`Error: ${res.error}`)
      } else {
        setTestResult(`Test notification sent! Check your screen.`)
      }
    } catch (err: unknown) {
      setTestResult(`Failed: ${(err as Error)?.message || 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Remove Other Device
  async function handleRemoveDevice(subId: string) {
    if (!confirm('Remove this device from your push notification list?')) return
    await removeSubscription({ id: subId })
    setOtherDevices((prev) => prev.filter((d) => d.id !== subId))
  }

  return (
    <div className="space-y-6">
      {/* Primary Device Card */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isSubscribedOnDevice
                  ? 'bg-success-bg text-success-text'
                  : permission === 'denied'
                  ? 'bg-danger-bg text-danger-text'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">
                Push notifications on this device
              </h3>
              <p className="text-xs text-text-secondary">
                {isSubscribedOnDevice
                  ? `Enabled on ${getDeviceLabel()}`
                  : permission === 'denied'
                  ? 'Notifications are blocked in your browser settings'
                  : 'Receive instant alerts for attendance, payments, and results'}
              </p>
            </div>
          </div>

          {isSubscribedOnDevice && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text bg-success-bg px-2.5 py-1 rounded-full">
              <CheckCircle className="w-3.5 h-3.5" /> Active
            </span>
          )}
        </div>

        {/* State 3: Permission Denied */}
        {permission === 'denied' && (
          <div className="mt-4 rounded-lg bg-danger-bg/50 border border-red-200 p-4 text-xs text-text-primary space-y-2">
            <p className="font-semibold text-danger-text flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Notification permissions are blocked
            </p>
            <p className="text-text-secondary leading-relaxed">
              Your browser has blocked notifications for Lantern. To receive alerts:
            </p>
            <ul className="list-disc list-inside text-text-secondary space-y-1">
              <li>Click the lock or settings icon next to the URL in your browser bar.</li>
              <li>Change <strong>Notifications</strong> to <strong>Allow</strong>.</li>
              <li>Refresh this page and tap Enable.</li>
            </ul>
          </div>
        )}

        {/* State 4: Permission not asked / Not enabled */}
        {permission !== 'denied' && !isSubscribedOnDevice && (
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={handleEnablePush}
              disabled={isLoading}
              className="inline-flex items-center gap-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover px-4 py-2.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
              Enable push alerts on this device
            </button>
          </div>
        )}

        {/* State 5: Enabled */}
        {isSubscribedOnDevice && (
          <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center gap-3">
            <button
              onClick={handleSendTest}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-text-primary bg-surface-muted hover:bg-surface-muted/80 border border-border px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              Send test notification
            </button>
            <button
              onClick={handleDisablePush}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-danger-text hover:bg-danger-bg/60 border border-transparent px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Turn off on this device
            </button>
          </div>
        )}

        {testResult && (
          <div className="mt-3 text-xs text-text-secondary bg-surface-muted p-2.5 rounded-lg flex items-center gap-2">
            <Info className="w-4 h-4 text-primary shrink-0" />
            <span>{testResult}</span>
          </div>
        )}
      </div>

      {/* Other Registered Devices */}
      {otherDevices.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Registered devices</h3>
              <p className="text-xs text-text-secondary">
                Devices linked to your portal login for receiving notifications.
              </p>
            </div>
            <span className="text-xs text-text-muted">{otherDevices.length} / 10 devices</span>
          </div>

          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
            {otherDevices.map((device) => {
              const isThisDevice = isSubscribedOnDevice && device.device_label === getDeviceLabel()
              return (
                <div key={device.id} className="p-3.5 flex items-center justify-between bg-surface">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center text-text-secondary">
                      {device.device_label?.toLowerCase().includes('phone') ? (
                        <Smartphone className="w-4 h-4" />
                      ) : (
                        <Laptop className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text-primary flex items-center gap-2">
                        {device.device_label || 'Browser Device'}
                        {isThisDevice && (
                          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-semibold">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        Added {new Date(device.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveDevice(device.id)}
                    aria-label="Remove device"
                    className="text-text-muted hover:text-danger-text p-1.5 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
