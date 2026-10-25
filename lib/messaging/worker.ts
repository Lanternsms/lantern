import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from './providers/email'
import { sendPush } from './push'
import { renderNotificationTemplate, extractFirstName } from './templates'
import type {
  NotificationDeliveryRow,
  NotificationRecord,
  PushSubscriptionRow,
} from './types'

// Concurrency helper
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  workerFn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0
  async function next() {
    while (index < items.length) {
      const current = items[index++]
      await workerFn(current)
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next())
  await Promise.all(workers)
}

// Backoff delay for retries (attempts: 1 -> 1m, 2 -> 5m, 3 -> 30m)
function getNextAttemptDate(attempts: number): string {
  const delaysMinutes = [1, 5, 30]
  const minutes = delaysMinutes[attempts - 1] || 30
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

export interface BatchProcessResult {
  claimed: number
  sent: number
  failed: number
  skipped: number
  remaining: boolean
}

/**
 * Claim and process a batch of pending deliveries using the database RPC.
 */
export async function processBatch(limit = 50): Promise<BatchProcessResult> {
  const admin = createAdminClient()

  // 1. Claim batch via service_role RPC claim_notification_deliveries(batch_size)
  const { data: claimedDeliveries, error: claimError } = await admin.rpc(
    'claim_notification_deliveries',
    { batch_size: limit }
  )

  if (claimError) {
    console.error('Error claiming deliveries via RPC:', claimError)
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, remaining: false }
  }

  const deliveries = (claimedDeliveries ?? []) as NotificationDeliveryRow[]
  if (deliveries.length === 0) {
    return { claimed: 0, sent: 0, failed: 0, skipped: 0, remaining: false }
  }

  // 2. Fetch associated notifications
  const notifIds = Array.from(new Set(deliveries.map((d) => d.notification_id)))
  const { data: notifications } = await admin
    .from('user_notifications')
    .select('id, school_id, recipient_id, type, category, title, body, url, student_id, actor_id, dedupe_key, created_at')
    .in('id', notifIds)

  const notifMap = new Map<string, NotificationRecord>()
  ;(notifications ?? []).forEach((n) => notifMap.set(n.id, n as NotificationRecord))

  // 3. Fetch school names
  const schoolIds = Array.from(new Set(deliveries.map((d) => d.school_id)))
  const { data: schools } = await admin
    .from('schools')
    .select('id, name')
    .in('id', schoolIds)

  const schoolNameMap = new Map<string, string>()
  ;(schools ?? []).forEach((s) => schoolNameMap.set(s.id, s.name))

  // 4. Fetch student first names if needed
  const studentIds = Array.from(
    new Set(
      (notifications ?? [])
        .map((n) => n.student_id)
        .filter(Boolean) as string[]
    )
  )

  const studentNameMap = new Map<string, string>()
  if (studentIds.length > 0) {
    const { data: students } = await admin
      .from('students')
      .select('id, first_name')
      .in('id', studentIds)

    ;(students ?? []).forEach((s) => {
      const firstName = extractFirstName(s.first_name)
      if (firstName) studentNameMap.set(s.id, firstName)
    })
  }

  // 5. Partition by channel
  const emailDeliveries = deliveries.filter((d) => d.channel === 'email')
  const pushDeliveries = deliveries.filter((d) => d.channel === 'push')

  let sentCount = 0
  let failedCount = 0
  let skippedCount = 0

  // 6. Process Email deliveries (Concurrency = 5)
  await runWithConcurrency(emailDeliveries, 5, async (deliv) => {
    const notif = notifMap.get(deliv.notification_id)
    if (!notif) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error: 'Parent notification not found',
        })
        .eq('id', deliv.id)
      failedCount++
      return
    }

    const schoolName = schoolNameMap.get(notif.school_id) || 'Lantern'
    const studentFirstName = notif.student_id ? studentNameMap.get(notif.student_id) : null

    const template = renderNotificationTemplate(notif.type, {
      notificationId: notif.id,
      schoolName,
      schoolId: notif.school_id,
      recipientId: notif.recipient_id,
      category: notif.category,
      studentFirstName,
    })

    const attempts = (deliv.attempts || 0) + 1
    const emailTo = deliv.address

    if (!emailTo) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'skipped',
          skip_reason: 'invalid_address',
          attempts,
        })
        .eq('id', deliv.id)
      skippedCount++
      return
    }

    const res = await sendEmail({
      to: emailTo,
      subject: template.emailSubject,
      html: template.emailHtml,
      text: template.emailText,
      category: notif.category,
      recipientId: notif.recipient_id,
      schoolId: notif.school_id,
      deliveryId: deliv.id,
    })

    const now = new Date().toISOString()
    if (res.ok) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'sent',
          attempts,
          provider: 'resend',
          provider_message_id: res.providerMessageId || null,
          sent_at: now,
          error: null,
        })
        .eq('id', deliv.id)
      sentCount++
    } else {
      const isRetryable = res.retryable && attempts < 4
      if (isRetryable) {
        const nextAttemptAt = getNextAttemptDate(attempts)
        await admin
          .from('notification_deliveries')
          .update({
            status: 'queued', // Put back to queued with future next_attempt_at
            attempts,
            next_attempt_at: nextAttemptAt,
            error: res.error || 'Email send failed',
          })
          .eq('id', deliv.id)
      } else {
        await admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            attempts,
            error: res.error || 'Email send failed permanently',
          })
          .eq('id', deliv.id)
        failedCount++
      }
    }
  })

  // 7. Process Push deliveries (Concurrency = 20)
  // Pre-load all push subscriptions for this batch's recipients
  const pushRecipientIds = Array.from(new Set(pushDeliveries.map((d) => d.recipient_id)))
  const { data: allSubscriptions } = await admin
    .from('push_subscriptions')
    .select('id, school_id, user_id, endpoint, p256dh, auth_secret, device_label, created_at, last_seen_at, failure_count')
    .in('user_id', pushRecipientIds)

  const subsByRecipient = new Map<string, PushSubscriptionRow[]>()
  ;(allSubscriptions ?? []).forEach((s) => {
    const list = subsByRecipient.get(s.user_id) || []
    list.push(s as PushSubscriptionRow)
    subsByRecipient.set(s.user_id, list)
  })

  await runWithConcurrency(pushDeliveries, 20, async (deliv) => {
    const notif = notifMap.get(deliv.notification_id)
    if (!notif) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'failed',
          error: 'Parent notification not found',
        })
        .eq('id', deliv.id)
      failedCount++
      return
    }

    const schoolName = schoolNameMap.get(notif.school_id) || 'Lantern'
    const studentFirstName = notif.student_id ? studentNameMap.get(notif.student_id) : null

    const template = renderNotificationTemplate(notif.type, {
      notificationId: notif.id,
      schoolName,
      schoolId: notif.school_id,
      recipientId: notif.recipient_id,
      category: notif.category,
      studentFirstName,
    })

    const subscriptions = subsByRecipient.get(deliv.recipient_id) || []
    const devicesTotal = subscriptions.length
    const attempts = (deliv.attempts || 0) + 1

    if (devicesTotal === 0) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'skipped',
          skip_reason: 'no_device',
          devices_total: 0,
          devices_ok: 0,
          attempts,
        })
        .eq('id', deliv.id)
      skippedCount++
      return
    }

    // Get unread notification count for app badge
    const { count: unreadCount } = await admin
      .from('user_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', deliv.recipient_id)
      .is('read_at', null)

    const payload = {
      title: template.pushTitle,
      body: template.pushBody,
      url: `/n/${notif.id}`,
      tag: notif.dedupe_key || `type-${notif.type}`,
      nid: notif.id,
      unread: unreadCount ?? 1,
    }

    // Send push to every subscription for this user
    let devicesOk = 0
    let anyRetryable = false
    let lastError: string | null = null

    for (const sub of subscriptions) {
      const pushRes = await sendPush(sub, payload, notif.category)
      if (pushRes.ok) {
        devicesOk++
      } else {
        lastError = pushRes.error || 'Push send failed'
        if (pushRes.retryable) {
          anyRetryable = true
        }
      }
    }

    const now = new Date().toISOString()
    // Sent if at least one device accepted
    if (devicesOk > 0) {
      await admin
        .from('notification_deliveries')
        .update({
          status: 'sent',
          attempts,
          devices_total: devicesTotal,
          devices_ok: devicesOk,
          provider: 'webpush',
          sent_at: now,
          error: null,
        })
        .eq('id', deliv.id)
      sentCount++
    } else {
      // All devices failed
      const isRetryable = anyRetryable && attempts < 4
      if (isRetryable) {
        const nextAttemptAt = getNextAttemptDate(attempts)
        await admin
          .from('notification_deliveries')
          .update({
            status: 'queued',
            attempts,
            devices_total: devicesTotal,
            devices_ok: 0,
            next_attempt_at: nextAttemptAt,
            error: lastError,
          })
          .eq('id', deliv.id)
      } else {
        await admin
          .from('notification_deliveries')
          .update({
            status: 'failed',
            attempts,
            devices_total: devicesTotal,
            devices_ok: 0,
            error: lastError || 'All push subscriptions failed',
          })
          .eq('id', deliv.id)
        failedCount++
      }
    }
  })

  return {
    claimed: deliveries.length,
    sent: sentCount,
    failed: failedCount,
    skipped: skippedCount,
    remaining: deliveries.length === limit,
  }
}
