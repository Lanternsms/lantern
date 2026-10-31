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

  const students = [...byStudent.values()].map((st) => {
    const vals = assessmentNames.map((n) => st.scores[n]).filter((v) => v !== undefined)
    return { ...st, total: vals.reduce((x, y) => x + Number(y), 0), missing: vals.length < assessmentNames.length }
  })
  const complete = students.filter((st) => !st.missing)
  const avg = complete.length ? complete.reduce((x, st) => x + st.total, 0) / complete.length : null
  const below40 = complete.filter((st) => st.total < 40).length
  const missing = students.length - complete.length

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
          <Link href="/dashboard/approvals" className="hover:text-text-primary">Approvals</Link> / {batch.terms?.name}
        </nav>
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[34px]">
          {batch.subjects?.name} · {batch.classes?.name}{batch.arms?.name ?? ''}
        </h1>
        <p className="text-[15px] text-text-secondary">
          Entered by {batch.profiles?.first_name} {batch.profiles?.last_name} · now at {batch.workflow_stages?.name}
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">{error}</p>}

      <section aria-label="Summary" className="card grid grid-cols-2 md:grid-cols-4">
        {[
          { label: 'Students', value: String(students.length), note: '' },
          { label: 'Class average', value: avg === null ? '—' : avg.toFixed(1), note: 'complete scores only' },
          { label: 'Below 40', value: String(below40), note: below40 ? 'worth a look' : '', warn: below40 > 0 },
          { label: 'Missing scores', value: String(missing), note: missing ? 'send back to complete' : 'all complete', warn: missing > 0 },
        ].map((k, i) => (
          <div key={k.label} className={`flex flex-col gap-1 px-5 py-4 ${i % 2 ? 'border-l border-rule' : ''} ${i > 1 ? 'border-t border-rule md:border-t-0' : ''} ${i === 2 ? 'md:border-l' : ''}`}>
            <span className="text-sm text-text-secondary">{k.label}</span>
            <span className={`font-display text-[28px] font-semibold leading-tight tabular-nums ${k.warn ? 'text-warning-text' : ''}`}>{k.value}</span>
            {k.note && <span className="text-xs text-text-secondary">{k.note}</span>}
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-[13px] text-text-secondary">
                <th className="px-5 py-3.5 text-left font-medium">Student</th>
                {assessmentNames.map((n) => <th key={n} className="px-3 py-3.5 text-right font-medium">{n}</th>)}
                <th className="px-5 py-3.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => (
                <tr key={st.admission} className="border-t border-rule">
                  <td className="px-5 py-3"><span className="block font-medium">{st.name}</span><span className="block text-xs text-text-secondary">{st.admission}</span></td>
                  {assessmentNames.map((n) => (
                    <td key={n} className={`px-3 py-3 text-right tabular-nums ${st.scores[n] === undefined ? 'text-danger-text' : ''}`}>{st.scores[n] ?? '—'}</td>
                  ))}
                  <td className={`px-5 py-3 text-right font-display text-[16px] font-semibold tabular-nums ${!st.missing && st.total < 40 ? 'text-warning-text' : ''}`}>{st.missing ? '—' : st.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={decideWithId} className="flex flex-col gap-3 rounded-[24px] bg-school-deep p-5 text-white shadow-raise xl:sticky xl:top-24">
          <h2 className="font-semibold">Your decision</h2>
          <p className="text-sm text-school-deep-muted">Approving moves these scores to the next stage. Sending back returns them to the teacher with your note.</p>
          <label className="flex flex-col gap-1.5 text-sm">
            Note to the teacher
            <textarea name="comment" rows={3} placeholder="Needed if you send it back" className="rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-[15px] text-white placeholder:text-white/45 focus:border-white/40 focus:outline-none" />
          </label>
          <button type="submit" name="action" value="approve" className="h-11 rounded-xl bg-white text-sm font-semibold text-school-deep hover:bg-school-soft">Approve</button>
          <button type="submit" name="action" value="return_to_teacher" className="h-11 rounded-xl border border-white/25 text-sm font-semibold text-white hover:bg-white/10">Send back to teacher</button>
        </form>
      </div>
    </div>
  )
}
