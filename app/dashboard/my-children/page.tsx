export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TermSelect } from '../my-results/term-select'
import { ChildSelect } from './child-select'
import TimetableGridView, { TimetableRow } from '../my-timetable/timetable-grid-view'

export const metadata = {
  title: 'My Children | Lantern',
}

export default async function MyChildrenPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; term?: string; error?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: guardianRow } = await supabase
    .from('guardians')
    .select('id, school_id, first_name, last_name, phone, email, relationship')
    .eq('profile_id', user.id)
    .single()

  if (!guardianRow) {
    return (
      <div className="px-8 py-8">
        <p className="text-sm text-text-secondary">
          No guardian record is linked to your account yet. Contact your school admin.
        </p>
      </div>
    )
  }

  const { data: links } = await supabase
    .from('student_guardians')
    .select('students(id, first_name, last_name, admission_no, school_id)')
    .eq('guardian_id', guardianRow.id)

  const myChildren = (links ?? [])
    .map((l) => l.students as { id: string; first_name: string; last_name: string; admission_no: string; school_id: string } | null)
    .filter((s): s is NonNullable<typeof s> => s !== null)

  const { child: childParam, term: termParam, error } = await searchParams
  const selectedChild = myChildren.find((c) => c.id === childParam) ?? myChildren[0]

  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current, academic_sessions(name)')
    .order('start_date', { ascending: false })

  const selectedTermId = termParam || terms?.find((t) => t.is_current)?.id || terms?.[0]?.id

  let subjectRows: { subject: string; scores: { label: string; score: number }[]; total: number; grade: { grade: string; remark: string | null } | null }[] = []
  let remark: { class_teacher_remark: string | null; principal_remark: string | null } | null = null
  let rank: { rank: number; out_of: number; metric: number } | null = null

  const admin = createAdminClient()

  if (selectedChild && selectedTermId) {
    // Use admin client so RLS doesn't block the guardian; join result_batches to
    // only surface published results (same fix as my-results page).
    const { data: results } = await admin
      .from('results')
      .select('score, subjects(name), assessment_types(name, weight), result_batches!inner(status)')
      .eq('student_id', selectedChild.id)
      .eq('term_id', selectedTermId)
      .eq('result_batches.status', 'published')

    const { data: remarkData } = await admin
      .from('result_remarks')
      .select('class_teacher_remark, principal_remark')
      .eq('student_id', selectedChild.id)
      .eq('term_id', selectedTermId)
      .maybeSingle()
    remark = remarkData ?? null

    const { data: rankData } = await supabase.rpc('get_my_rank', {
      p_term_id: selectedTermId,
      p_student_id: selectedChild.id,
    })
    rank = rankData?.[0] ?? null

    const { data: scale } = await admin
      .from('grading_scales')
      .select('grade_bands(min_score, max_score, grade, remark)')
      .eq('school_id', selectedChild.school_id)
      .eq('is_default', true)
      .maybeSingle()

    const bySubject = new Map<string, { scores: { label: string; score: number }[]; total: number }>()
    for (const r of results ?? []) {
      const subjectName = (r.subjects as { name: string } | null)?.name ?? 'Unknown subject'
      const assessmentName = (r.assessment_types as { name: string } | null)?.name ?? ''
      const entry = bySubject.get(subjectName) ?? { scores: [], total: 0 }
      entry.scores.push({ label: assessmentName, score: r.score })
      entry.total += r.score
      bySubject.set(subjectName, entry)
    }

    const bands = (scale?.grade_bands as { min_score: number; max_score: number; grade: string; remark: string | null }[]) ?? []
    subjectRows = Array.from(bySubject.entries()).map(([subject, data]) => ({
      subject,
      ...data,
      grade: bands.find((b) => data.total >= b.min_score && data.total <= b.max_score) ?? null,
    }))
  }

  const currentTerm = terms?.find((t) => t.id === selectedTermId)

  // Timetable for the selected child
  let timetablePeriods: { id: string; name: string; start_time: string; end_time: string; is_break: boolean }[] = []
  let timetableRows: TimetableRow[] = []

  if (selectedChild) {
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', selectedChild.school_id)
      .eq('is_current', true)
      .single()

    const { data: periodsData } = await supabase
      .from('timetable_periods')
      .select('id, name, start_time, end_time, is_break')
      .order('sort_order')

    timetablePeriods = periodsData ?? []

    if (session) {
      // Find the child's enrolment to know their class/arm
      const { data: enrolment } = await supabase
        .from('enrolments')
        .select('class_id, arm_id')
        .eq('student_id', selectedChild.id)
        .eq('session_id', session.id)
        .maybeSingle()

      if (enrolment?.class_id) {
        let entriesQuery = supabase
          .from('timetable_entries')
          .select('day_of_week, period_id, subjects(name), teacher:profiles(first_name, last_name)')
          .eq('session_id', session.id)
          .eq('class_id', enrolment.class_id)

        if (enrolment.arm_id) {
          entriesQuery = entriesQuery.eq('arm_id', enrolment.arm_id)
        } else {
          entriesQuery = entriesQuery.is('arm_id', null)
        }

        const { data: entries } = await entriesQuery

        timetableRows = (entries ?? []).map((e: any) => ({
          day_of_week: e.day_of_week,
          period_id: e.period_id,
          subject_name: e.subjects?.name ?? '',
          teacher_name: e.teacher ? `${e.teacher.first_name} ${e.teacher.last_name}` : null,
        }))
      }
    }
  }

  return (
    <div className="px-8 py-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-text-primary mb-6">My Children</h1>

      {/* Own contact info — read-only; changes go through the school admin */}
      <div className="bg-surface border border-border rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-text-primary mb-3">My Contact Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="block text-xs text-text-secondary mb-1">Phone</span>
            <span className="text-text-primary">{guardianRow.phone || '—'}</span>
          </div>
          <div>
            <span className="block text-xs text-text-secondary mb-1">Email</span>
            <span className="text-text-primary">{guardianRow.email || '—'}</span>
          </div>
        </div>
        <p className="text-xs text-text-secondary mt-3">
          To update your contact details, please contact your school admin.
        </p>
      </div>

      {myChildren.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-6 text-sm text-text-secondary">
          No children are linked to your account yet.
        </div>
      ) : (
        <>
          <div className="mb-4 flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {selectedChild?.first_name} {selectedChild?.last_name} &middot; {selectedChild?.admission_no}
              </h2>
              {rank && (
                <p className="text-sm text-text-secondary mt-1">
                  Position: <span className="font-semibold text-text-primary">{rank.rank}</span> of {rank.out_of}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ChildSelect children={myChildren} selectedStudentId={selectedChild?.id ?? ''} />
              {terms && selectedTermId && <TermSelect terms={terms} selectedTermId={selectedTermId} />}
              {selectedChild && selectedTermId && (
                <Link
                  href={`/dashboard/students/${selectedChild.id}/report-card?term_id=${selectedTermId}`}
                  className="inline-flex items-center text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-1.5 rounded-lg transition-colors"
                >
                  View Full Report Card
                </Link>
              )}
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

          <div className="bg-surface border border-border rounded-xl p-5 mt-6">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Timetable</h2>
            <TimetableGridView periods={timetablePeriods} rows={timetableRows} mode="student" />
          </div>
        </>
      )}
    </div>
  )
}
