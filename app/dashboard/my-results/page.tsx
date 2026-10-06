import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TermSelect } from './term-select'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'My Results | Lantern',
}

export default async function MyResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: studentRow } = await supabase
    .from('students')
    .select('id, school_id, first_name, last_name, admission_no')
    .eq('profile_id', user.id)
    .single()

  if (!studentRow) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">
          No student record is linked to your account yet. Contact your school admin.
        </p>
      </div>
    )
  }

  // Terms for the picker, most recent first
  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current, academic_sessions(name)')
    .order('start_date', { ascending: false })

  const { term: termParam } = await searchParams
  const selectedTermId = termParam || terms?.find((t) => t.is_current)?.id || terms?.[0]?.id

  if (!selectedTermId) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">No academic terms have been set up yet.</p>
      </div>
    )
  }

  const admin = createAdminClient()

  // Fetch only published results for this student
  const { data: results } = await admin
    .from('results')
    .select('score, subjects(name), assessment_types(name, weight), result_batches!inner(status)')
    .eq('student_id', studentRow.id)
    .eq('term_id', selectedTermId)
    .eq('result_batches.status', 'published')

  const { data: remark } = await admin
    .from('result_remarks')
    .select('class_teacher_remark, principal_remark')
    .eq('student_id', studentRow.id)
    .eq('term_id', selectedTermId)
    .maybeSingle()

  const { data: rankData } = await supabase.rpc('get_my_rank', { p_term_id: selectedTermId })
  const rank = rankData?.[0] ?? null

  // Group scores by subject, sum to a total
  const bySubject = new Map<string, { scores: { label: string; score: number }[]; total: number }>()
  for (const r of results ?? []) {
    const subjectName = (r.subjects as { name: string } | null)?.name ?? 'Unknown subject'
    const assessmentName = (r.assessment_types as { name: string } | null)?.name ?? ''
    const entry = bySubject.get(subjectName) ?? { scores: [], total: 0 }
    entry.scores.push({ label: assessmentName, score: r.score })
    entry.total += r.score
    bySubject.set(subjectName, entry)
  }

  // Grade lookup from the school's default grading scale
  const { data: scale } = await admin
    .from('grading_scales')
    .select('id, grade_bands(min_score, max_score, grade, remark)')
    .eq('school_id', studentRow.school_id)
    .eq('is_default', true)
    .maybeSingle()

  function gradeFor(total: number) {
    const bands = (scale?.grade_bands as { min_score: number; max_score: number; grade: string; remark: string | null }[]) ?? []
    return bands.find((b) => total >= b.min_score && total <= b.max_score) ?? null
  }

  const subjectRows = Array.from(bySubject.entries()).map(([subject, data]) => ({
    subject,
    ...data,
    grade: gradeFor(data.total),
  }))

  const currentTerm = terms?.find((t) => t.id === selectedTermId)

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary mb-1">My Results</h1>
          <p className="text-sm text-text-secondary">
            {studentRow.first_name} {studentRow.last_name} &middot; {studentRow.admission_no}
          </p>
          {rank && (
            <p className="text-sm text-text-secondary mt-1">
              Position: <span className="font-semibold text-text-primary">{rank.rank}</span> of {rank.out_of}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TermSelect terms={terms ?? []} selectedTermId={selectedTermId} />
          <Link
            href={`/dashboard/students/${studentRow.id}/report-card${selectedTermId ? `?term_id=${selectedTermId}` : ''}`}
            className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-1.5 rounded-lg transition-colors"
          >
            View Full Report Card
          </Link>
        </div>
      </div>

      {subjectRows.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-sm text-text-secondary">
          No published results for {currentTerm?.name ?? 'this term'} yet.
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-text-secondary text-xs">
              <tr>
                <th className="text-left px-4 py-2.5">Subject</th>
                <th className="text-left px-4 py-2.5">Breakdown</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-right px-4 py-2.5">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjectRows.map((row) => (
                <tr key={row.subject} className="border-t border-border">
                  <td className="px-4 py-2.5 font-medium text-text-primary">{row.subject}</td>
                  <td className="px-4 py-2.5 text-text-secondary">
                    {row.scores.map((s) => `${s.label}: ${s.score}`).join('  ·  ')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-text-primary">{row.total}</td>
                  <td className="px-4 py-2.5 text-right">
                    {row.grade ? `${row.grade.grade}${row.grade.remark ? ` (${row.grade.remark})` : ''}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remark && (remark.class_teacher_remark || remark.principal_remark) && (
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Report Card Remarks</h2>
          {remark.class_teacher_remark && (
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Class Teacher: </span>
              {remark.class_teacher_remark}
            </p>
          )}
          {remark.principal_remark && (
            <p className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">Principal: </span>
              {remark.principal_remark}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
