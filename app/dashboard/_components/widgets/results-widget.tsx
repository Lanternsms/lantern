import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export async function ResultsWidget() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
  if (!profile) return null

  const { data: currentSession } = await supabase
    .from('academic_sessions').select('id').eq('school_id', profile.school_id).eq('is_current', true).maybeSingle()
  const { data: currentTerm } = currentSession
    ? await supabase.from('terms').select('id').eq('school_id', profile.school_id).eq('session_id', currentSession.id).eq('is_current', true).maybeSingle()
    : { data: null }

  const { data: batches } = currentTerm
    ? await supabase.from('result_batches').select('status').eq('school_id', profile.school_id).eq('term_id', currentTerm.id)
    : { data: [] as { status: string }[] }

  const published = (batches ?? []).filter((b) => b.status === 'published').length
  const pending = (batches ?? []).length - published

  return (
    <div className="border border-border rounded-xl p-5 bg-surface h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text-primary">Results</h2>
        <Link href="/dashboard/results" className="text-xs font-medium text-primary hover:underline">View Results</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-text-secondary">Published</p>
          <p className="font-semibold text-emerald-600">{published}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Pending</p>
          <p className="font-semibold text-amber-600">{pending}</p>
        </div>
      </div>
    </div>
  )
}