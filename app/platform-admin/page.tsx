export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { unlockPlatformAdmin } from './actions'

export default async function PlatformAdminGatePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await hasValidPlatformAdminSession()) {
    redirect('/platform-admin/demos')
  }

  const { error } = await searchParams

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-muted px-4">
      <form action={unlockPlatformAdmin} className="card w-full max-w-sm p-6 space-y-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">Platform Admin</h1>
          <p className="mt-1 text-[15px] text-text-secondary">Internal tool. Not for school staff.</p>
        </div>
        {error && (
          <p className="text-sm text-danger-text bg-danger-bg border border-danger-bg rounded-lg px-3 py-2">Incorrect password.</p>
        )}
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="bg-surface border border-control rounded-xl w-full px-3 py-2 text-sm text-text-primary"
        />
        <button type="submit" className="w-full bg-primary text-white text-sm font-medium py-2 rounded-xl hover:bg-primary-hover transition-colors">
          Unlock
        </button>
      </form>
    </div>
  )
}