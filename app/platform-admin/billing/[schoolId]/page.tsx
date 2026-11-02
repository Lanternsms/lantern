import { redirect, notFound } from 'next/navigation'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../../_components/platform-admin-nav'
import { lockPlatformAdmin } from '../../actions'
import { updateSubscription } from './actions'

type SubRow = {
  plan: string
  status: string
  billing_cycle: string
  amount: number | null
  currency: string
  current_period_start: string | null
  current_period_end: string | null
  trial_ends_at: string | null
  notes: string | null
} | null

export default async function BillingDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = await params
  const valid = await hasValidPlatformAdminSession()
  if (!valid) redirect('/platform-admin')

  const admin = createAdminClient()
  const { data: school } = await admin
    .from('schools')
    .select('id, name, platform_subscriptions(*)')
    .eq('id', schoolId)
    .single()

  if (!school) notFound()

  const sub = (school as unknown as { platform_subscriptions: SubRow }).platform_subscriptions
  const updateWithId = updateSubscription.bind(null, schoolId)

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-[28px] font-semibold leading-tight text-text-primary sm:text-[32px]">{school.name} — Billing</h1>
        <form action={lockPlatformAdmin}>
          <button type="submit" className="text-sm text-text-secondary hover:text-text-primary">Lock</button>
        </form>
      </div>
      <PlatformAdminNav active="billing" />

      <form action={updateWithId} className="space-y-5 border border-border rounded-lg p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Plan</label>
            <select name="plan" defaultValue={sub?.plan ?? 'trial'} className="w-full border border-control rounded-lg px-3 py-2 text-sm">
              <option value="trial">Trial</option>
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
            <select name="status" defaultValue={sub?.status ?? 'trialing'} className="w-full border border-control rounded-lg px-3 py-2 text-sm">
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past due</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Billing cycle</label>
            <select name="billing_cycle" defaultValue={sub?.billing_cycle ?? 'termly'} className="w-full border border-control rounded-lg px-3 py-2 text-sm">
              <option value="monthly">Monthly</option>
              <option value="termly">Termly</option>
              <option value="annually">Annually</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Currency</label>
            <input name="currency" defaultValue={sub?.currency ?? 'NGN'} className="w-full border border-control rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Amount</label>
            <input type="number" step="0.01" name="amount" defaultValue={sub?.amount ?? ''} className="w-full border border-control rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Trial ends</label>
            <input type="date" name="trial_ends_at" defaultValue={sub?.trial_ends_at ?? ''} className="w-full border border-control rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Period start</label>
            <input type="date" name="current_period_start" defaultValue={sub?.current_period_start ?? ''} className="w-full border border-control rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Period end</label>
            <input type="date" name="current_period_end" defaultValue={sub?.current_period_end ?? ''} className="w-full border border-control rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={sub?.notes ?? ''}
            placeholder="e.g. Paid via bank transfer, ref #..."
            className="w-full border border-control rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="bg-text-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-text-primary">
          Save changes
        </button>
      </form>
    </div>
  )
}