import 'server-only'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPolicyRule } from './policy'
import { resolveUserEmails } from './email-resolver'
import { processBatch } from './worker'
import type { NotificationRecord, SkipReason } from './types'

interface DeliveryInsert {
  notification_id: string
  school_id: string
  recipient_id: string
  channel: 'email' | 'push'
  address: string | null
  status: 'queued' | 'skipped'
  skip_reason: SkipReason | null
  attempts: number
  next_attempt_at: string
}

/**
 * Route external deliveries (push & email) for newly inserted notifications.
 * Must NEVER throw errors back to the caller.
 */
export async function routeExternal(
  newNotifications: NotificationRecord[]
): Promise<void> {
  if (!newNotifications || newNotifications.length === 0) return

  try {
    const admin = createAdminClient()

    // 1. Gather unique recipient IDs and school IDs
    const recipientIds = Array.from(new Set(newNotifications.map((n) => n.recipient_id)))
    const schoolIds = Array.from(new Set(newNotifications.map((n) => n.school_id)))

    // 2. Security isolation: verify recipients belong to the event's school
    const { data: recipientProfiles } = await admin
      .from('profiles')
      .select('id, school_id')
      .in('id', recipientIds)

    const profileSchoolMap = new Map<string, string>()
    ;(recipientProfiles ?? []).forEach((p) => {
      profileSchoolMap.set(p.id, p.school_id)
    })

    // 3. Fetch school notification settings (missing row = both enabled)
    const { data: schoolSettingsList } = await admin
      .from('school_notification_settings')
      .select('school_id, email_enabled, push_enabled')
      .in('school_id', schoolIds)

    const schoolSettingsMap = new Map<string, { email_enabled: boolean; push_enabled: boolean }>()
    ;(schoolSettingsList ?? []).forEach((s) => {
      schoolSettingsMap.set(s.school_id, {
        email_enabled: s.email_enabled,
        push_enabled: s.push_enabled,
      })
    })

    // 4. Fetch notification preferences for recipients
    const categories = Array.from(new Set(newNotifications.map((n) => n.category)))
    const { data: preferencesList } = await admin
      .from('notification_preferences')
      .select('user_id, category, in_app, email, push')
      .in('user_id', recipientIds)
      .in('category', categories)

    const prefMap = new Map<string, { email: boolean | null; push: boolean | null }>()
    ;(preferencesList ?? []).forEach((p) => {
      prefMap.set(`${p.user_id}:${p.category}`, {
        email: p.email,
        push: p.push,
      })
    })

    // 5. Fetch active push subscriptions count per user
    const { data: subsList } = await admin
      .from('push_subscriptions')
      .select('user_id, id')
      .in('user_id', recipientIds)

    const userPushCountMap = new Map<string, number>()
    ;(subsList ?? []).forEach((s) => {
      userPushCountMap.set(s.user_id, (userPushCountMap.get(s.user_id) || 0) + 1)
    })

    // 6. Resolve emails for all recipients
    const emailMap = await resolveUserEmails(recipientIds)
    const distinctEmails = Array.from(new Set(Array.from(emailMap.values()).filter(Boolean))) as string[]

    // 7. Check email suppressions
    const suppressedSet = new Set<string>()
    if (distinctEmails.length > 0) {
      const { data: suppressions } = await admin
        .from('email_suppressions')
        .select('email')
        .in('email', distinctEmails)

      ;(suppressions ?? []).forEach((s) => {
        suppressedSet.add(s.email.toLowerCase())
      })
    }

    // 8. Daily caps checking
    const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
    const schoolDailyCap = parseInt(process.env.EMAIL_SCHOOL_DAILY_CAP || '2000', 10)

    // Check school email counts today
    const { data: todayDeliveries } = await admin
      .from('notification_deliveries')
      .select('school_id, recipient_id, channel, status')
      .gte('created_at', todayStart)
      .in('status', ['queued', 'claimed', 'sent'])

    const schoolEmailCount = new Map<string, number>()
    const userEmailCount = new Map<string, number>()
    const userPushCount = new Map<string, number>()

    ;(todayDeliveries ?? []).forEach((d) => {
      if (d.channel === 'email') {
        schoolEmailCount.set(d.school_id, (schoolEmailCount.get(d.school_id) || 0) + 1)
        userEmailCount.set(d.recipient_id, (userEmailCount.get(d.recipient_id) || 0) + 1)
      } else if (d.channel === 'push') {
        userPushCount.set(d.recipient_id, (userPushCount.get(d.recipient_id) || 0) + 1)
      }
    })

    // 9. Staging allowlist
    const rawAllowlist = process.env.MESSAGING_ALLOWLIST
    const allowlist = rawAllowlist
      ? new Set(
          rawAllowlist
            .split(',')
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean)
        )
      : null

    const deliveryRows: DeliveryInsert[] = []
    const nowIso = new Date().toISOString()

    for (const notif of newNotifications) {
      // (e) Verify recipient belongs to event school
      const recipientSchool = profileSchoolMap.get(notif.recipient_id)
      if (!recipientSchool || recipientSchool !== notif.school_id) {
        continue
      }

      const schoolSetting = schoolSettingsMap.get(notif.school_id) || {
        email_enabled: true,
        push_enabled: true,
      }

      const policy = getPolicyRule(notif.type, notif.category)
      const userPref = prefMap.get(`${notif.recipient_id}:${notif.category}`)

      const userEmail = emailMap.get(notif.recipient_id) || null
      const hasPushDevice = (userPushCountMap.get(notif.recipient_id) || 0) > 0

      // (a) Resolve policy / preferences
      const pushWanted =
        userPref?.push !== null && userPref?.push !== undefined ? userPref.push : policy.push

      let emailWanted =
        userPref?.email !== null && userPref?.email !== undefined ? userPref.email : policy.email

      if (policy.emailLocked) {
        emailWanted = true // Cannot be disabled (e.g. account)
      } else if (policy.emailOnlyIfNoPush) {
        // e.g. Q&A: push; email ONLY if recipient has no push subscription
        emailWanted = !hasPushDevice
      }

      // --- PUSH CHANNEL ---
      if (pushWanted) {
        let pushStatus: 'queued' | 'skipped' = 'queued'
        let pushSkipReason: SkipReason | null = null

        if (!schoolSetting.push_enabled) {
          pushStatus = 'skipped'
          pushSkipReason = 'channel_disabled'
        } else if (!hasPushDevice) {
          pushStatus = 'skipped'
          pushSkipReason = 'no_device'
        } else if (allowlist && userEmail && !allowlist.has(userEmail)) {
          // Push only to allowlisted users when allowlist is set
          pushStatus = 'skipped'
          pushSkipReason = 'not_allowlisted'
        } else {
          // Check daily push cap (40 per recipient)
          const currentPush = userPushCount.get(notif.recipient_id) || 0
          if (currentPush >= 40) {
            pushStatus = 'skipped'
            pushSkipReason = 'cap_exceeded'
          } else {
            userPushCount.set(notif.recipient_id, currentPush + 1)
          }
        }

        deliveryRows.push({
          notification_id: notif.id,
          school_id: notif.school_id,
          recipient_id: notif.recipient_id,
          channel: 'push',
          address: null,
          status: pushStatus,
          skip_reason: pushSkipReason,
          attempts: 0,
          next_attempt_at: nowIso,
        })
      }

      // --- EMAIL CHANNEL ---
      if (emailWanted) {
        let emailStatus: 'queued' | 'skipped' = 'queued'
        let emailSkipReason: SkipReason | null = null

        if (!schoolSetting.email_enabled) {
          emailStatus = 'skipped'
          emailSkipReason = 'channel_disabled'
        } else if (!userEmail) {
          emailStatus = 'skipped'
          emailSkipReason = 'invalid_address'
        } else if (suppressedSet.has(userEmail.toLowerCase())) {
          emailStatus = 'skipped'
          emailSkipReason = 'suppressed'
        } else if (allowlist && !allowlist.has(userEmail.toLowerCase())) {
          emailStatus = 'skipped'
          emailSkipReason = 'not_allowlisted'
        } else {
          // Check user cap (20 per day) and school cap
          const currentUserEmail = userEmailCount.get(notif.recipient_id) || 0
          const currentSchoolEmail = schoolEmailCount.get(notif.school_id) || 0

          if (currentUserEmail >= 20 || currentSchoolEmail >= schoolDailyCap) {
            emailStatus = 'skipped'
            emailSkipReason = 'cap_exceeded'
          } else {
            userEmailCount.set(notif.recipient_id, currentUserEmail + 1)
            schoolEmailCount.set(notif.school_id, currentSchoolEmail + 1)
          }
        }

        deliveryRows.push({
          notification_id: notif.id,
          school_id: notif.school_id,
          recipient_id: notif.recipient_id,
          channel: 'email',
          address: userEmail,
          status: emailStatus,
          skip_reason: emailSkipReason,
          attempts: 0,
          next_attempt_at: nowIso,
        })
      }
    }

    if (deliveryRows.length > 0) {
      // Chunk inserts to handle any large batch
      const chunkSize = 200
      for (let i = 0; i < deliveryRows.length; i += chunkSize) {
        const chunk = deliveryRows.slice(i, i + chunkSize)
        await admin.from('notification_deliveries').upsert(chunk, {
          onConflict: 'notification_id,channel',
          ignoreDuplicates: true,
        })
      }

      // Kick worker asynchronously via Next.js after()
      try {
        after(async () => {
          await processBatch(50)
        })
      } catch {
        // Fallback if called outside request context (e.g. background job)
        processBatch(50).catch((wErr) => console.error('Worker kick error:', wErr))
      }
    }
  } catch (err) {
    console.error('routeExternal error (never thrown to caller):', err)
  }
}
