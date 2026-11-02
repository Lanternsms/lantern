export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { lockPlatformAdmin } from '../actions'
import { OnboardForm } from './onboard-form'
import { PlatformAdminNav } from '../_components/platform-admin-nav'

export default async function OnboardPage() {
  if (!(await hasValidPlatformAdminSession())) {
    redirect('/platform-admin')
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
        <OnboardForm />
      </div>
    </div>
  )
}