import { redirect } from 'next/navigation'
import Link from 'next/link'
import { hasValidPlatformAdminSession } from '@/lib/platform-admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlatformAdminNav } from '../_components/platform-admin-nav'
import { lockPlatformAdmin } from '../actions'

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
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
        <h1 className="text-xl font-semibold text-gray-900">Subscription & Billing</h1>
        <form action={lockPlatformAdmin}>
          <button type="submit" className="text-sm text-gray-500 hover:text-gray-800">Lock</button>
        </form>
      </div>
      <PlatformAdminNav active="billing" />

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3 font-medium">School</th>
              <th className="text-left px-4 py-3 font-medium">Plan</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Period ends</th>
              <th className="text-right px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((school) => {
              const sub = school.platform_subscriptions
              const status = sub?.status ?? 'trialing'
              return (
                <tr key={school.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{school.name}</p>
                    <p className="text-xs text-gray-400">{school.slug}</p>
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">{sub?.plan ?? 'trial'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? STATUS_STYLES.trialing}`}>
                      {status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {sub?.amount ? `${sub.currency} ${Number(sub.amount).toLocaleString()} / ${sub.billing_cycle}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {status === 'trialing'
                      ? sub?.trial_ends_at ? `Trial ends ${sub.trial_ends_at}` : '—'
                      : sub?.current_period_end ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/platform-admin/billing/${school.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      Manage
                    </Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No schools yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}