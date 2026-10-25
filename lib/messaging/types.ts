import 'server-only'
import type { Category } from '@/lib/notifications/types'

export type RecipientKind = 'guardian' | 'student' | 'staff'

export type Channel = 'email' | 'push'

export type DeliveryStatus = 'queued' | 'claimed' | 'sent' | 'failed' | 'skipped'

export type SkipReason =
  | 'channel_disabled'
  | 'not_allowlisted'
  | 'suppressed'
  | 'no_device'
  | 'cap_exceeded'
  | 'invalid_address'

export interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
  nid?: string
  unread?: number
}

export interface NotificationTemplate {
  pushTitle: string
  pushBody: string
  emailSubject: string
  emailText: string
  emailHtml: string
}

export interface PushSubscriptionRow {
  id: string
  school_id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_secret: string
  device_label?: string | null
  user_agent?: string | null
  created_at: string
  last_seen_at: string
  last_success_at?: string | null
  failure_count: number
}

export interface NotificationDeliveryRow {
  id: string
  notification_id: string
  school_id: string
  recipient_id: string
  channel: Channel
  address: string | null
  status: DeliveryStatus
  skip_reason: string | null
  attempts: number
  next_attempt_at: string
  claimed_at: string | null
  provider: string | null
  provider_message_id: string | null
  error: string | null
  devices_total: number | null
  devices_ok: number | null
  created_at: string
  sent_at: string | null
  delivered_at: string | null
}

export interface NotificationRecord {
  id: string
  school_id: string
  recipient_id: string
  type: string
  category: Category
  title: string
  body: string | null
  url: string | null
  student_id: string | null
  actor_id: string | null
  dedupe_key: string | null
  created_at: string
}
