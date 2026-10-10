'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { logPlatformAction } from '@/lib/platform-admin/audit'

export async function updateSubscription(schoolId: string, formData: FormData) {
  const valid = await hasValidPlatformAdminSession()
  if (!valid) redirect('/platform-admin')

  const admin = createAdminClient()

  const { data: before } = await admin
    .from('platform_subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle()

  const next = {
    school_id: schoolId,
    plan: String(formData.get('plan') || 'trial'),
    status: String(formData.get('status') || 'trialing'),
    billing_cycle: String(formData.get('billing_cycle') || 'termly'),
    currency: String(formData.get('currency') || 'NGN'),
    amount: formData.get('amount') ? Number(formData.get('amount')) : null,
    trial_ends_at: (formData.get('trial_ends_at') as string) || null,
    current_period_start: (formData.get('current_period_start') as string) || null,
    current_period_end: (formData.get('current_period_end') as string) || null,
    notes: (String(formData.get('notes') || '')) || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await admin
    .from('platform_subscriptions')
    .upsert(next, { onConflict: 'school_id' })

  if (error) {
    throw new Error(`Couldn't save subscription: ${error.message}`)
  }

  await logPlatformAction('subscription_updated', {
    schoolId,
    metadata: { before: before ?? null, after: next },
  })

  revalidatePath(`/platform-admin/billing/${schoolId}`)
  revalidatePath('/platform-admin/billing')
  redirect('/platform-admin/billing')
}