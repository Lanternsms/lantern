import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { decideBatch } from '@/app/dashboard/approvals/actions'
import { sortAssessmentNames } from '@/lib/report-card'
import Link from 'next/link'

export default async function ApprovalReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const { data: batch, error: fetchError } = await supabase
    .from('result_batches')
    .select('id, status, classes(name), arms(name), subjects(name), terms(name), profiles(first_name, last_name), workflow_stages(name)')
    .eq('id', id)
    .single()

  if (fetchError || !batch) notFound()

  const { data: results } = await supabase
    .from('results')
    .select('score, students(first_name, last_name, admission_no), assessment_types(name)')
    .eq('batch_id', id)
    .order('students(last_name)')

  const decideWithId = decideBatch.bind(null, id)

  // Group scores per student so each row shows every assessment type together
  const byStudent = new Map<string, { name: string; admission: string; scores: Record<string, number> }>()
  for (const r of results ?? []) {
    const key = r.students?.admission_no ?? ''
    if (!byStudent.has(key)) {
      byStudent.set(key, { name: `${r.students?.first_name} ${r.students?.last_name}`, admission: key, scores: {} })
    }
    byStudent.get(key)!.scores[r.assessment_types?.name ?? ''] = r.score
  }
  const assessmentNames = sortAssessmentNames([...new Set((results ?? []).map((r) => r.assessment_types?.name ?? ''))])

  return (
    <div className="px-8 py-8">
      <Link href="/dashboard/approvals" className="text-sm text-primary hover:text-primary-hover">← Back to approvals</Link>

      <h1 className="text-xl font-semibold text-text-primary mt-4 mb-1">
        {batch.subjects?.name} - {batch.classes?.name}{batch.arms?.name ? ` ${batch.arms.name}` : ''}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        {batch.terms?.name} · Submitted by {batch.profiles?.first_name} {batch.profiles?.last_name} · Currently at {batch.workflow_stages?.name}
      </p>

      {error && <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}

      <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Student</th>
              {assessmentNames.map((n) => (
                <th key={n} className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...byStudent.values()].map((s) => (
              <tr key={s.admission} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-text-primary">{s.name}<span className="block text-xs text-text-secondary">{s.admission}</span></td>
                {assessmentNames.map((n) => (
                  <td key={n} className="px-4 py-3 text-text-primary">{s.scores[n] ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={decideWithId} className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <label className="block text-sm text-text-secondary mb-1.5">Comment (optional)</label>
        <textarea name="comment" rows={2} className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <div className="flex gap-3">
          <button type="submit" name="action" value="approve" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            Approve
          </button>
          <button type="submit" name="action" value="return_to_teacher" className="text-sm text-danger-text border border-red-200 rounded-lg px-4 py-2 hover:bg-danger-bg transition-colors">
            Return to Teacher
          </button>
        </div>
      </form>
    </div>
  )
}