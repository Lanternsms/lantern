'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMyAccessContext } from '@/lib/permissions'
import { sendEmail } from '@/lib/messaging/providers/email'
import { resolveUserEmails } from '@/lib/messaging/email-resolver'
import { maskEmail } from '@/lib/messaging/utils'
import { revalidatePath } from 'next/cache'

async function checkAdminAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Authentication required')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) {
    throw new Error('School profile not found')
  }

  const ctx = await getMyAccessContext(supabase)
  const isAuthorized = ctx.permissions.has('settings.manage') || ctx.permissions.has('school.manage')
  if (!isAuthorized) {
    throw new Error('Permission denied (settings.manage required)')
  }

  return { user, profile }
}

export async function updateSchoolNotificationSettings(settings: {
  email_enabled: boolean
  push_enabled: boolean
}) {
  const { profile } = await checkAdminAuth()
  const admin = createAdminClient()

  const { error } = await admin.from('school_notification_settings').upsert({
    school_id: profile.school_id,
    email_enabled: settings.email_enabled,
    push_enabled: settings.push_enabled,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error updating school notification settings:', error)
    return { error: 'Failed to update school notification settings' }
  }

  revalidatePath('/dashboard/settings/notifications')
  return { success: true }
}

export async function sendTestEmailToCaller() {
  const { user, profile } = await checkAdminAuth()
  const admin = createAdminClient()

  const emailMap = await resolveUserEmails([user.id])
  const email = emailMap.get(user.id)

  if (!email) {
    return { error: 'No confirmed email address found for your account' }
  }

  const { data: school } = await admin
    .from('schools')
    .select('name')
    .eq('id', profile.school_id)
    .single()

  const schoolName = school?.name || 'Lantern'

  const res = await sendEmail({
    to: email,
    subject: `Lantern Test Email from ${schoolName}`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #f8f9fb; padding: 24px; color: #1f2430;">
  <div style="max-width: 480px; margin: 0 auto; background: white; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
    <h2 style="color: #182350; margin-top: 0;">Email Delivery Test Successful</h2>
    <p style="font-size: 14px; color: #4b5563; line-height: 1.5;">
      This email confirms that transactional email delivery is active and functioning properly for <strong>${schoolName}</strong>.
    </p>
    <p style="font-size: 12px; color: #9ca3af;">Sent to ${maskEmail(email)} from Lantern Notification System.</p>
  </div>
</body>
</html>`,
    text: `Lantern Test Email: Email delivery for ${schoolName} is active and functioning properly.`,
    category: 'system',
    recipientId: user.id,
    schoolId: profile.school_id,
    deliveryId: `admin_test_${Date.now()}`,
  })

  if (!res.ok) {
    return { error: res.error || 'Failed to send test email' }
  }

  return { success: true, email: maskEmail(email) }
}
