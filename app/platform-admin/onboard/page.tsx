export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { lockPlatformAdmin } from '../actions'
import { OnboardForm, type OnboardPrefill } from './onboard-form'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../_components/platform-admin-nav'

export default async function OnboardPage({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  if (!(await hasValidPlatformAdminSession())) {
    redirect('/platform-admin')
  }

  // Coming from a won demo request: prefill the school and its first admin.
  const { demo } = await searchParams
  let prefill: OnboardPrefill | null = null
  if (demo) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (createAdminClient() as any).from('demo_requests').select('id, name, school, email').eq('id', demo).maybeSingle()
    if (data) {
      const parts = String(data.name).replace(/^(mr|mrs|ms|miss|dr|prof|chief|alhaji|alhaja)\.?\s+/i, '').trim().split(/\s+/)
      prefill = { demoId: data.id, schoolName: data.school, firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), email: data.email ?? '' }
    }
  }

  return (
    <div className="min-h-screen bg-surface-muted px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">New School Onboarding</h1>
            <p className="mt-1 text-[15px] text-text-secondary">Internal tool — creates a new tenant and its first admin account.</p>
          </div>
          <form action={lockPlatformAdmin}>
            <button type="submit" className="text-xs text-text-secondary hover:text-text-primary">Lock</button>
          </form>
        </div>
        <PlatformAdminNav active="onboard" />
        <OnboardForm prefill={prefill} />
      </div>
    </div>
  )
}