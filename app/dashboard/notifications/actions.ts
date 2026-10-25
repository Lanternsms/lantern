'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/messaging/push'
import type { Category } from '@/lib/notifications/types'
import { revalidatePath } from 'next/cache'

export interface SaveSubscriptionInput {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
  deviceLabel?: string
}

export interface UserSubscriptionInfo {
  id: string
  school_id: string
  user_id: string
  device_label: string | null
  created_at: string
  last_seen_at: string
}

/**
 * Save or update a push subscription for the signed-in user.
 * Upserts on endpoint, reassigning to current user and school if shared, capped at 10 devices.
 */
export async function saveSubscription(input: SaveSubscriptionInput) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) {
    return { error: 'Profile not found' }
  }

  // Validate HTTPS endpoint and keys
  if (!input.endpoint || !input.endpoint.startsWith('https://')) {
    return { error: 'Invalid push endpoint URL' }
  }
  if (!input.keys?.p256dh || !input.keys?.auth) {
    return { error: 'Invalid encryption keys' }
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Upsert subscription
  const { error: upsertError } = await admin
    .from('push_subscriptions')
    .upsert(
      {
        endpoint: input.endpoint,
        user_id: user.id,
        school_id: profile.school_id,
        p256dh: input.keys.p256dh,
        auth_secret: input.keys.auth,
        device_label: input.deviceLabel || 'Browser Device',
        last_seen_at: now,
        failure_count: 0,
      },
      { onConflict: 'endpoint' }
    )

  if (upsertError) {
    console.error('Error saving push subscription:', upsertError)
    return { error: 'Could not save subscription' }
  }

  // Cap to 10 devices per user (remove oldest)
  const { data: userSubs } = await admin
    .from('push_subscriptions')
    .select('id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (userSubs && userSubs.length > 10) {
    const subsToDelete = userSubs.slice(10).map((s) => s.id)
    await admin.from('push_subscriptions').delete().in('id', subsToDelete)
  }

  revalidatePath('/dashboard/notifications/settings')
  return { success: true }
}

/**
 * Remove a subscription owned by the current user.
 */
export async function removeSubscription(identifier: { id?: string; endpoint?: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required' }
  }

  const admin = createAdminClient()
  let query = admin.from('push_subscriptions').delete().eq('user_id', user.id)

  if (identifier.id) {
    query = query.eq('id', identifier.id)
  } else if (identifier.endpoint) {
    query = query.eq('endpoint', identifier.endpoint)
  } else {
    return { error: 'Missing subscription identifier' }
  }

  const { error } = await query
  if (error) {
    console.error('Error removing push subscription:', error)
    return { error: 'Could not remove subscription' }
  }

  revalidatePath('/dashboard/notifications/settings')
  return { success: true }
}

/**
 * Send a test push notification strictly to caller's registered devices.
 */
export async function sendTestPush() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required' }
  }

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, school_id, user_id, endpoint, p256dh, auth_secret, device_label, created_at, last_seen_at, failure_count')
    .eq('user_id', user.id)

  if (!subs || subs.length === 0) {
    return { error: 'No active push subscriptions found on your account' }
  }

  let sentOk = 0
  for (const sub of subs) {
    const res = await sendPush(sub, {
      title: 'Lantern Test Alert',
      body: 'Push notifications are enabled and functioning properly on this device.',
      url: '/dashboard/notifications/settings',
      tag: 'test-ping',
    })
    if (res.ok) sentOk++
  }

  return { success: true, count: sentOk }
}

/**
 * Fetch caller's registered push subscriptions (only safe explicit columns, never keys).
 */
export async function getMyPushSubscriptions(): Promise<UserSubscriptionInfo[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from('push_subscriptions')
    .select('id, school_id, user_id, device_label, created_at, last_seen_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []) as UserSubscriptionInfo[]
}

/**
 * Save notification preferences for the caller.
 */
export async function savePreferences(
  updates: Array<{ category: Category; email: boolean | null; push: boolean | null; in_app?: boolean }>
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Authentication required' }
  }

  const admin = createAdminClient()

  for (const item of updates) {
    // Account email cannot be disabled
    let emailVal = item.email
    if (item.category === 'account') {
      emailVal = true
    }

    await admin.from('notification_preferences').upsert(
      {
        user_id: user.id,
        category: item.category,
        in_app: item.in_app !== undefined ? item.in_app : true,
        email: emailVal,
        push: item.push,
      },
      { onConflict: 'user_id,category' }
    )
  }

  revalidatePath('/dashboard/notifications/settings')
  return { success: true }
}
