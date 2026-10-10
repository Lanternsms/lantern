import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function formatNaira(amount: number) {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`
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

  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Fees Overview</h2>
        <Link href="/dashboard/fees/structures" className="text-xs font-medium text-primary hover:underline">View Fees</Link>
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-secondary">Expected</p>
          <p className="font-semibold text-text-primary">{formatNaira(expected)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Collected</p>
          <p className="font-semibold text-emerald-600">{formatNaira(collected)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Rate</p>
          <p className="font-semibold text-text-primary">{rate.toFixed(1)}%</p>
        </div>
      </div>
    </div>
  )
}