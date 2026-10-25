import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react'

export async function ApprovalsWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  // Query batches awaiting approval
  const { count: pendingCount } = await supabase
    .from('result_batches')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', profile.school_id)
    .eq('status', 'in_review')

  const count = pendingCount ?? 0

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              count > 0 ? 'bg-amber-50 text-amber-600 border-amber-200/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
            }`}>
              {count > 0 ? <ShieldAlert size={20} /> : <CheckCircle2 size={20} />}
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Result Approvals</h2>
              <p className="text-xs text-text-secondary mt-0.5">Academic batch verification queue</p>
            </div>
          </div>
          <Link
            href="/dashboard/approvals"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Queue →
          </Link>
        </div>

        {count > 0 ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-200 flex items-start gap-3">
              <span className="flex h-2.5 w-2.5 translate-y-1.5 rounded-full bg-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {count} {count === 1 ? 'batch' : 'batches'} awaiting your review
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                  Teachers have submitted result scores for administrative sign-off before publishing.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/approvals"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-colors shadow-xs"
            >
              Open Approvals Queue <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-1.5 bg-surface-muted/30">
            <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2 border border-emerald-200">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-sm font-semibold text-text-primary">Approvals Queue Clear</p>
            <p className="text-xs text-text-secondary">
              All submitted result batches have been processed.
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Workflow Sign-Off</span>
        <Link href="/dashboard/approvals" className="font-semibold text-primary hover:underline">
          View all stages →
        </Link>
      </div>
    </div>
  )
}