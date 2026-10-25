import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Wallet, TrendingUp } from 'lucide-react'

function formatNaira(amount: number) {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}K`
  return `₦${amount.toLocaleString()}`
}

export async function FeesWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_current', true)
    .maybeSingle()
  const { data: currentTerm } = currentSession
    ? await supabase.from('terms').select('id').eq('school_id', profile.school_id).eq('session_id', currentSession.id).eq('is_current', true).maybeSingle()
    : { data: null }

  const { data: feeStructures } = currentTerm
    ? await supabase.from('fee_structures').select('id, class_id, amount').eq('school_id', profile.school_id).eq('term_id', currentTerm.id)
    : { data: [] as { id: string; class_id: string | null; amount: number }[] }

  const { data: enrolmentRows } = currentSession
    ? await supabase.from('enrolments').select('class_id').eq('school_id', profile.school_id).eq('session_id', currentSession.id)
    : { data: [] as { class_id: string }[] }

  const countByClass = new Map<string, number>()
  for (const row of enrolmentRows ?? []) countByClass.set(row.class_id, (countByClass.get(row.class_id) ?? 0) + 1)
  const totalEnrolled = enrolmentRows?.length ?? 0

  let expected = 0
  for (const fs of feeStructures ?? []) {
    const qualifying = fs.class_id ? (countByClass.get(fs.class_id) ?? 0) : totalEnrolled
    expected += Number(fs.amount) * qualifying
  }

  const ids = (feeStructures ?? []).map((f) => f.id)
  const { data: paymentRows } = ids.length > 0
    ? await supabase.from('payments').select('amount_paid').eq('school_id', profile.school_id).in('fee_structure_id', ids)
    : { data: [] as { amount_paid: number }[] }
  const collected = (paymentRows ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const rate = expected > 0 ? (collected / expected) * 100 : 0
  const outstanding = Math.max(0, expected - collected)

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200/60">
              <Wallet size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Fees &amp; Billing</h2>
              <p className="text-xs text-text-secondary mt-0.5">Term collections &amp; outstanding balances</p>
            </div>
          </div>
          <Link
            href="/dashboard/fees/structures"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Structures →
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {rate.toFixed(1)}%
              </span>
              <span className="text-xs text-text-secondary ml-2 font-medium">collected this term</span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-muted text-text-secondary border border-border">
              <TrendingUp size={12} className="text-emerald-500" />
              {totalEnrolled} students
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-border/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rate))}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80">
              <span className="text-text-secondary block mb-0.5">Expected</span>
              <span className="text-sm font-bold text-text-primary">{formatNaira(expected)}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80">
              <span className="text-text-secondary block mb-0.5">Collected</span>
              <span className="text-sm font-bold text-emerald-600">{formatNaira(collected)}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80">
              <span className="text-text-secondary block mb-0.5">Outstanding</span>
              <span className={`text-sm font-bold ${outstanding > 0 ? 'text-red-600' : 'text-text-primary'}`}>
                {formatNaira(outstanding)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Payment Receipts</span>
        <Link href="/dashboard/payments" className="font-semibold text-primary hover:underline">
          View all transactions →
        </Link>
      </div>
    </div>
  )
}