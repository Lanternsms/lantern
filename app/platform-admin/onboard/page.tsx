export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { lockPlatformAdmin } from '../actions'
import { OnboardForm } from './onboard-form'

export default async function OnboardPage() {
  if (!(await hasValidPlatformAdminSession())) {
    redirect('/platform-admin')
  }

  return (
    <div className="min-h-screen bg-surface-muted px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-text-primary">New School Onboarding</h1>
            <p className="text-sm text-text-secondary mt-1">Internal tool — creates a new tenant and its first admin account.</p>
          </div>
          <form action={lockPlatformAdmin}>
            <button type="submit" className="text-xs text-text-secondary hover:text-text-primary">Lock</button>
          </form>
        </div>
        <OnboardForm />
      </div>
    </div>
  )
}