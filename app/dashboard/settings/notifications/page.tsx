import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { getMyAccessContext } from '@/lib/permissions'
import {
  AdminNotificationSettingsClient,
  type ChannelStats,
  type AdoptionStats,
  type RecentDeliveryItem,
} from './admin-client'
import { maskEmail, maskEndpoint } from '@/lib/messaging/utils'

export const metadata = {
  title: 'Notification Settings & Health – Lantern Admin',
  description: 'Manage school notification delivery and monitor adoption',
}

export default async function AdminNotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) {
    redirect('/login')
  }

  const ctx = await getMyAccessContext(supabase)
  const isAuthorized = ctx.permissions.has('settings.manage') || ctx.permissions.has('school.manage')
  if (!isAuthorized) {
    redirect('/dashboard')
  }

  const admin = createAdminClient()
  const schoolId = profile.school_id

  // 1. Fetch school notification settings
  const { data: schoolSetting } = await admin
    .from('school_notification_settings')
    .select('email_enabled, push_enabled')
    .eq('school_id', schoolId)
    .maybeSingle()

  const initialSettings = {
    email_enabled: schoolSetting?.email_enabled ?? true,
    push_enabled: schoolSetting?.push_enabled ?? true,
  }

  // 2. Fetch today's deliveries
  const todayStart = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
  const { data: todayDeliveries } = await admin
    .from('notification_deliveries')
    .select('channel, status')
    .eq('school_id', schoolId)
    .gte('created_at', todayStart)

  const todayStats: { email: ChannelStats; push: ChannelStats } = {
    email: { sent: 0, failed: 0, skipped: 0, queued: 0 },
    push: { sent: 0, failed: 0, skipped: 0, queued: 0 },
  }

  ;(todayDeliveries ?? []).forEach((d) => {
    const ch = d.channel as 'email' | 'push'
    if (todayStats[ch]) {
      if (d.status === 'sent') todayStats[ch].sent++
      else if (d.status === 'failed') todayStats[ch].failed++
      else if (d.status === 'skipped') todayStats[ch].skipped++
      else if (d.status === 'queued' || d.status === 'claimed') todayStats[ch].queued++
    }
  })

  // 3. Push Adoption (number of users with at least one device, per kind, counts only)
  const [{ data: guardiansWithLogin }, { data: studentsWithLogin }, { data: allSchoolProfiles }] =
    await Promise.all([
      admin
        .from('guardians')
        .select('profile_id')
        .eq('school_id', schoolId)
        .not('profile_id', 'is', null),
      admin
        .from('students')
        .select('profile_id')
        .eq('school_id', schoolId)
        .not('profile_id', 'is', null),
      admin.from('profiles').select('id').eq('school_id', schoolId),
    ])

  const guardianProfileIds = new Set((guardiansWithLogin ?? []).map((g) => g.profile_id as string))
  const studentProfileIds = new Set((studentsWithLogin ?? []).map((s) => s.profile_id as string))

  const staffProfileIds = new Set(
    (allSchoolProfiles ?? [])
      .map((p) => p.id)
      .filter((id) => !guardianProfileIds.has(id) && !studentProfileIds.has(id))
  )

  // Subscribed users in this school
  const { data: schoolSubs } = await admin
    .from('push_subscriptions')
    .select('user_id')
    .eq('school_id', schoolId)

  const distinctSubscribedUserIds = new Set((schoolSubs ?? []).map((s) => s.user_id))

  let guardianSubCount = 0
  let studentSubCount = 0
  let staffSubCount = 0

  distinctSubscribedUserIds.forEach((uid) => {
    if (guardianProfileIds.has(uid)) guardianSubCount++
    if (studentProfileIds.has(uid)) studentSubCount++
    if (staffProfileIds.has(uid)) staffSubCount++
  })

  const adoption: AdoptionStats = {
    guardians: { subscribed: guardianSubCount, total: guardianProfileIds.size },
    students: { subscribed: studentSubCount, total: studentProfileIds.size },
    staff: { subscribed: staffSubCount, total: staffProfileIds.size },
  }

  // 4. Last 20 failed or skipped deliveries
  const { data: recentExceptions } = await admin
    .from('notification_deliveries')
    .select('id, channel, status, skip_reason, error, created_at, address')
    .eq('school_id', schoolId)
    .in('status', ['failed', 'skipped'])
    .order('created_at', { ascending: false })
    .limit(20)

  const recentDeliveries: RecentDeliveryItem[] = (recentExceptions ?? []).map((item) => ({
    id: item.id,
    channel: item.channel as 'email' | 'push',
    status: item.status,
    skip_reason: item.skip_reason,
    error: item.error,
    created_at: item.created_at,
    masked_address:
      item.channel === 'email'
        ? maskEmail(item.address)
        : maskEndpoint(item.address),
  }))

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Notification Delivery &amp; Settings
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Monitor outbound messaging channels, push adoption, and delivery health across your school.
        </p>
      </div>

      <AdminNotificationSettingsClient
        initialSettings={initialSettings}
        todayStats={todayStats}
        adoption={adoption}
        recentDeliveries={recentDeliveries}
      />
    </div>
  )
}
