import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Award, CheckCircle2, Clock } from 'lucide-react'

export async function ResultsWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { data: currentSession } = await supabase
    .from('academic_sessions').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle()
  const { data: currentTerm } = currentSession
    ? await supabase.from('terms').select('id, name').eq('school_id', profile.school_id).eq('session_id', currentSession.id).eq('is_current', true).maybeSingle()
    : { data: null }

  const { data: batches } = currentTerm
    ? await supabase.from('result_batches').select('status').eq('school_id', profile.school_id).eq('term_id', currentTerm.id)
    : { data: [] as { status: string }[] }

  const published = (batches ?? []).filter((b) => b.status === 'published').length
  const total = (batches ?? []).length
  const pending = total - published
  const publishRate = total > 0 ? (published / total) * 100 : 0

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-xs h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-200/60">
              <Award size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Academic Results</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                {currentTerm?.name ? `Term progress (${currentTerm.name})` : 'Batches & grading'}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/results"
            className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1 transition-colors"
          >
            Review →
          </Link>
        </div>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-text-primary tracking-tight">
                {published}
              </span>
              <span className="text-xs text-text-secondary ml-2 font-medium">of {total} batches published</span>
            </div>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
              {publishRate.toFixed(0)}% Complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-border/60 rounded-full h-2.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, publishRate))}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
                <CheckCircle2 size={15} />
              </div>
              <div>
                <span className="text-text-secondary block text-[11px]">Published</span>
                <span className="text-sm font-bold text-emerald-600">{published} batches</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-surface-muted/50 border border-border/80 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <Clock size={15} />
              </div>
              <div>
                <span className="text-text-secondary block text-[11px]">In Review / Draft</span>
                <span className="text-sm font-bold text-amber-600">{pending} batches</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-4 mt-2 border-t border-border flex items-center justify-between text-xs text-text-secondary">
        <span>Report Cards &amp; Remarks</span>
        <Link href="/dashboard/results/remarks" className="font-semibold text-primary hover:underline">
          Manage remarks →
        </Link>
      </div>
    </div>
  )
}