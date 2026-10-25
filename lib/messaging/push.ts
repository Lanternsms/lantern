import 'server-only'
import webpush from 'web-push'
import type { PushPayload, PushSubscriptionRow } from './types'
import { maskEndpoint } from './utils'
import { createAdminClient } from '@/lib/supabase/admin'

let vapidConfigured = false

function ensureVapidConfig() {
  if (vapidConfigured) return true
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com'
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY

  if (!publicKey || !privateKey) {
    return false
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch (err) {
    console.error('Failed to configure VAPID details:', err)
    return false
  }
}

export interface PushSendResult {
  ok: boolean
  expired?: boolean
  retryable?: boolean
  error?: string
}

/**
 * Send a web push notification to a single subscription.
 * Handles TTL, urgency, payload size limit, VAPID signing, and status error codes.
 */
export async function sendPush(
  sub: PushSubscriptionRow,
  payload: PushPayload,
  category?: string
): Promise<PushSendResult> {
  const isLogMode = process.env.MESSAGING_MODE === 'log'
  const maskedEp = maskEndpoint(sub.endpoint)

  // Determine urgency
  const highUrgencyCategories = ['attendance', 'fees', 'results']
  const urgency: webpush.Urgency =
    category && highUrgencyCategories.includes(category) ? 'high' : 'normal'

  // Ensure JSON payload is under 3 KB
  const rawPayload = JSON.stringify(payload)
  if (Buffer.byteLength(rawPayload, 'utf8') > 3072) {
    payload = {
      title: payload.title,
      body: payload.body.slice(0, 150) + '…',
      url: payload.url,
      tag: payload.tag,
      nid: payload.nid,
      unread: payload.unread,
    }
  }
  const payloadStr = JSON.stringify(payload)

  if (isLogMode) {
    console.log(
      `[MESSAGING:LOG] WebPush to ${maskedEp} (user: ${sub.user_id.slice(0, 8)}...): "${payload.title}" - ${payload.body}`
    )
    return { ok: true }
  }

  if (!ensureVapidConfig()) {
    return {
      ok: false,
      retryable: false,
      error: 'VAPID keys not configured',
    }
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth_secret,
        },
      },
      payloadStr,
      {
        TTL: 86400, // 24 hours
        urgency,
      }
    )

    return { ok: true }
  } catch (err: unknown) {
    const errorObj = err as { statusCode?: number; message?: string }
    const status = errorObj.statusCode || 500
    const msg = errorObj.message || 'Push service error'

    // 404 Not Found or 410 Gone means the subscription has expired or was revoked
    if (status === 404 || status === 410) {
      console.warn(`[WebPush] Subscription expired (${status}) for ${maskedEp}; deleting subscription.`)
      try {
        const admin = createAdminClient()
        await admin.from('push_subscriptions').delete().eq('id', sub.id)
      } catch (delErr) {
        console.error('Failed to remove dead subscription:', delErr)
      }
      return {
        ok: false,
        expired: true,
        retryable: false,
        error: `Subscription expired (${status})`,
      }
    }

    // 429 Too Many Requests or 5xx Server Error are retryable
    const isRetryable = status === 429 || status >= 500

    return {
      ok: false,
      retryable: isRetryable,
      error: `Push failed (${status}): ${msg}`,
    }
  }
}
