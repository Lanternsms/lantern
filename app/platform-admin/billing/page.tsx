import { redirect } from 'next/navigation'
import Link from 'next/link'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../_components/platform-admin-nav'
import { lockPlatformAdmin } from '../actions'

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-school-soft text-school-ink border-school-track',
  active: 'bg-success-bg text-success-text border-success-bg',
  past_due: 'bg-warning-bg text-warning-text border-warning-bg',
  suspended: 'bg-danger-bg text-danger-text border-danger-bg',
  cancelled: 'bg-raised text-text-secondary border-border',
}

type SchoolRow = {
  id: string
  name: string
  slug: string
  platform_subscriptions: {
    plan: string
    status: string
    billing_cycle: string
    amount: number | null
    currency: string
    current_period_end: string | null
    trial_ends_at: string | null
  } | null
}

export default async function BillingPage() {
  const valid = await hasValidPlatformAdminSession()
  if (!valid) redirect('/platform-admin')

  const admin = createAdminClient()
  const { data: schools } = await admin
    .from('schools')
    .select('id, name, slug, platform_subscriptions(plan, status, billing_cycle, amount, currency, current_period_end, trial_ends_at)')
    .order('name')

  const rows = (schools ?? []) as unknown as SchoolRow[]

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-text-primary">Subscription & Billing</h1>
        <form action={lockPlatformAdmin}>
          <button type="submit" className="text-sm text-text-secondary hover:text-text-primary">Lock</button>
        </form>
      </div>
      <PlatformAdminNav active="billing" />

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-raised text-text-secondary text-xs ">
            <tr>
              <th className="text-left px-4 py-3 font-medium">School</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Period ends</th>
              <th className="text-right px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((school) => {
              const sub = school.platform_subscriptions
              const status = sub?.status ?? 'trialing'
              return (
                <tr key={school.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{school.name}</p>
                    <p className="text-xs text-text-muted">{school.slug}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-text-primary">{sub?.plan ?? 'trial'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? STATUS_STYLES.trialing}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {sub?.amount ? `${sub.currency} ${Number(sub.amount).toLocaleString()} / ${sub.billing_cycle}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-text-primary">
                    {status === 'trialing'
                      ? sub?.trial_ends_at ? `Trial ends ${sub.trial_ends_at}` : '—'
                      : sub?.current_period_end ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/platform-admin/billing/${school.id}`} className="text-sm font-medium text-school-ink hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted">No schools yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}