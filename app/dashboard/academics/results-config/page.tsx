import { createClient } from '@/lib/supabase/server'
import { updateResultComputationRules } from '@/app/dashboard/academics/results-config/actions'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

export default async function ResultComputationRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { error, success } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user!.id).single()

  const { data: rules } = await supabase
    .from('result_computation_rules')
    .select('ranking_enabled, rank_by, exclude_electives_from_rank, show_rank_to_students, show_rank_to_parents')
    .eq('school_id', profile!.school_id)
    .maybeSingle()

  // Sensible defaults if no row exists yet — matches the schema's own
  // column defaults, so a school that's never touched this page still
  // sees the same behavior their results would actually follow.
  const current = {
    ranking_enabled: rules?.ranking_enabled ?? true,
    rank_by: rules?.rank_by ?? 'average',
    exclude_electives_from_rank: rules?.exclude_electives_from_rank ?? false,
    show_rank_to_students: rules?.show_rank_to_students ?? true,
    show_rank_to_parents: rules?.show_rank_to_parents ?? true,
  }

  return (
    <div className="px-8 py-8 max-w-lg">
      <p className="text-sm text-text-secondary mb-1">
        <Link href="/dashboard/academics" className="hover:text-primary">Academics</Link> / Result Rules
      </p>
      <h1 className="text-xl font-semibold text-text-primary mb-1">Result Computation Rules</h1>
      <p className="text-sm text-text-secondary mb-6">
        Control how class positions are calculated, and who can see them once results are published.
      </p>

      {error && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}
      {success && (
        <div className="flex items-center gap-2 text-sm text-success-text bg-success-bg rounded-lg px-3 py-2 mb-4">
          <CheckCircle2 size={16} /> Settings saved.
        </div>
      )}

      <form action={updateResultComputationRules} className="bg-surface border border-border rounded-xl p-6 space-y-6">
        <div>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Enable Class Ranking</p>
              <p className="text-xs text-text-secondary mt-0.5">Calculate and store a student&apos;s position in their class each term.</p>
            </div>
            <input
              type="checkbox"
              name="ranking_enabled"
              defaultChecked={current.ranking_enabled}
              className="w-4 h-4 rounded border-border"
            />
          </label>
        </div>

        <div className="border-t border-border pt-5">
          <p className="text-sm font-medium text-text-primary mb-2">Rank By</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="radio" name="rank_by" value="average" defaultChecked={current.rank_by === 'average'} className="border-border" />
              Average score
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="radio" name="rank_by" value="total" defaultChecked={current.rank_by === 'total'} className="border-border" />
              Total score
            </label>
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text-primary">Exclude Electives from Ranking</p>
              <p className="text-xs text-text-secondary mt-0.5">Only compulsory subjects count toward class position.</p>
            </div>
            <input
              type="checkbox"
              name="exclude_electives_from_rank"
              defaultChecked={current.exclude_electives_from_rank}
              className="w-4 h-4 rounded border-border"
            />
          </label>
        </div>

        <div className="border-t border-border pt-5 space-y-4">
          <p className="text-sm font-medium text-text-primary">Rank Visibility</p>
          <label className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Show rank to students</p>
            <input
              type="checkbox"
              name="show_rank_to_students"
              defaultChecked={current.show_rank_to_students}
              className="w-4 h-4 rounded border-border"
            />
          </label>
          <label className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">Show rank to parents</p>
            <input
              type="checkbox"
              name="show_rank_to_parents"
              defaultChecked={current.show_rank_to_parents}
              className="w-4 h-4 rounded border-border"
            />
          </label>
        </div>

        <button type="submit" className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-medium rounded-lg py-2.5 transition-colors">
          Save Settings
        </button>
      </form>
    </div>
  )
}