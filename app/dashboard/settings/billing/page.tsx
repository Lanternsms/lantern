import { createClient } from '@/lib/supabase/server'

const STATUS_STYLES: Record<string, string> = {
  trialing: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  past_due: 'bg-amber-50 text-amber-700 border-amber-200',
  suspended: 'bg-red-50 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
}

const STATUS_MESSAGES: Record<string, string> = {
  trialing: "You're on a free trial.",
  active: 'Your subscription is active and in good standing.',
  past_due: 'A payment is overdue. Please contact Lantern support to avoid service interruption.',
  suspended: 'This account has been suspended due to non-payment. Contact Lantern support to restore access.',
  cancelled: 'This subscription has been cancelled.',
}

export default async function BillingStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return null

  const { data: sub } = await supabase
    .from('platform_subscriptions')
    .select('*')
    .eq('school_id', profile.school_id)
    .maybeSingle()

  if (!sub) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-xl font-semibold text-text-primary mb-2">Billing</h1>
        <p className="text-sm text-text-secondary">
          You don&apos;t have permission to view billing information, or it hasn&apos;t been set up for your school yet.
        </p>
      </div>
    )
  }

  const status = sub.status as string

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Billing</h1>
        <p className="text-sm text-text-secondary mt-1">Your school&apos;s subscription status with Lantern.</p>
      </div>

      <div className="border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Plan</p>
            <p className="text-base font-semibold text-text-primary capitalize">{sub.plan}</p>
          </div>
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? STATUS_STYLES.trialing}`}>
            {status.replace('_', ' ')}
          </span>
        </div>

        <p className="text-sm text-text-secondary border-t border-border pt-4">
          {STATUS_MESSAGES[status] ?? ''}
        </p>

        <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Amount</p>
            <p className="text-text-primary">
              {sub.amount ? `${sub.currency} ${Number(sub.amount).toLocaleString()} / ${sub.billing_cycle}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
              {status === 'trialing' ? 'Trial ends' : 'Current period ends'}
            </p>
            <p className="text-text-primary">
              {status === 'trialing' ? (sub.trial_ends_at ?? '—') : (sub.current_period_end ?? '—')}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        To make a payment, change your plan, or ask a billing question, please contact Lantern support.
      </p>
    </div>
  )
}