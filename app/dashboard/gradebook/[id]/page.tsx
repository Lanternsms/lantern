import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { saveScores, submitForApproval } from '@/app/dashboard/gradebook/actions'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'

type StudentRelation = {
  first_name: string
  last_name: string
  admission_no: string
}

export default async function GradebookEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; submitted?: string }>
}) {
  const { id } = await params
  const { error, saved, submitted } = await searchParams
  const supabase = await createClient()

  const { data: cs, error: fetchError } = await supabase
    .from('class_subjects')
    .select('id, class_id, arm_id, subject_id, classes(name), arms(name), subjects(name)')
    .eq('id', id)
    .single()

  if (fetchError || !cs) notFound()

  const { data: term } = await supabase.from('terms').select('id, session_id, name').eq('is_current', true).single()
  if (!term) {
    return <div className="px-8 py-8"><p className="text-sm text-text-secondary">No current term is set.</p></div>
  }

  const { data: rawAssessmentTypes } = await supabase.from('assessment_types').select('id, name')
  const assessmentTypes = rawAssessmentTypes
    ? [...rawAssessmentTypes].sort((a, b) => {
        const isExamA = /exam/i.test(a.name)
        const isExamB = /exam/i.test(b.name)
        if (isExamA && !isExamB) return 1
        if (!isExamA && isExamB) return -1
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
      })
    : null

  const admin = createAdminClient()
  let enrolQuery = admin
    .from('enrolments')
    .select('student_id, students(first_name, last_name, admission_no)')
    .eq('session_id', term.session_id)
    .eq('class_id', cs.class_id)

  if (cs.arm_id) {
    enrolQuery = enrolQuery.eq('arm_id', cs.arm_id)
  }

  const { data: enrolments } = await enrolQuery

  const sortedEnrolments = enrolments
    ? [...enrolments].sort((a, b) => {
        const sa = (Array.isArray(a.students) ? a.students[0] : a.students) as StudentRelation | null
        const sb = (Array.isArray(b.students) ? b.students[0] : b.students) as StudentRelation | null
        const nameA = `${sa?.last_name ?? ''} ${sa?.first_name ?? ''}`.trim()
        const nameB = `${sb?.last_name ?? ''} ${sb?.first_name ?? ''}`.trim()
        return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
      })
    : []

  const { data: { user } } = await supabase.auth.getUser()
  const { data: batch } = await supabase
    .from('result_batches')
    .select('id, status')
    .eq('term_id', term.id)
    .eq('class_id', cs.class_id)
    .eq('subject_id', cs.subject_id)
    .eq('submitted_by', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: existingResults } = batch
    ? await supabase.from('results').select('student_id, assessment_type_id, score').eq('batch_id', batch.id)
    : { data: null }

  const scoreByKey = new Map((existingResults ?? []).map((r) => [`${r.student_id}_${r.assessment_type_id}`, r.score]))

  const isLocked = batch && batch.status !== 'draft' && batch.status !== 'returned'

  const saveScoresWithId = saveScores.bind(null, id)
  const submitWithId = submitForApproval.bind(null, id)

  return (
    <div className="px-8 py-8">
      <Link href="/dashboard/gradebook" className="text-sm text-primary hover:text-primary-hover">← Back to gradebook</Link>

      <div className="flex items-center justify-between mt-4 mb-1">
        <h1 className="text-xl font-semibold text-text-primary">
          {cs.subjects?.name} - {cs.classes?.name}{cs.arms?.name ? ` ${cs.arms.name}` : ''}
        </h1>
        {batch && (
          <span className="text-xs font-medium bg-secondary/10 text-secondary rounded-full px-2.5 py-1 capitalize">
            {batch.status.replace('_', ' ')}
          </span>
        )}
      </div>
      <p className="text-sm text-text-secondary mb-6">{term.name}</p>

      {error && <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>}
      {saved && (
        <p className="flex items-center gap-2 text-sm text-success-text bg-success-bg rounded-lg px-3 py-2 mb-4">
          <CheckCircle2 size={16} /> Scores saved.
        </p>
      )}
      {submitted && (
        <p className="flex items-center gap-2 text-sm text-success-text bg-success-bg rounded-lg px-3 py-2 mb-4">
          <CheckCircle2 size={16} /> Submitted for approval.
        </p>
      )}
      {isLocked && (
        <p className="text-sm text-text-secondary bg-surface-muted border border-border rounded-lg px-3 py-2 mb-4">
          This batch has already been submitted and can no longer be edited here.
        </p>
      )}

      {sortedEnrolments.length === 0 ? (
        <p className="text-sm text-text-secondary">No students enrolled in this class for the current term.</p>
      ) : (
        <form action={saveScoresWithId}>
          <div className="bg-surface border border-border rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">Student</th>
                  {assessmentTypes?.map((at) => (
                    <th key={at.id} className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">{at.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEnrolments.map((e) => {
                  const student = (Array.isArray(e.students) ? e.students[0] : e.students) as StudentRelation | null
                  return (
                    <tr key={e.student_id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text-primary">
                        {student ? `${student.first_name} ${student.last_name}` : 'Unknown Student'}
                        <span className="block text-xs text-text-secondary">{student?.admission_no}</span>
                      </td>
                      {assessmentTypes?.map((at) => (
                        <td key={at.id} className="px-4 py-3">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            disabled={!!isLocked}
                            name={`score_${e.student_id}_${at.id}`}
                            defaultValue={scoreByKey.get(`${e.student_id}_${at.id}`) ?? ''}
                            className="w-20 rounded-lg border border-border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-surface-muted disabled:text-text-muted"
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!isLocked && (
            <button type="submit" className="text-sm text-text-primary border border-border rounded-lg px-4 py-2 hover:bg-surface-muted transition-colors">
              Save Scores
            </button>
          )}
        </form>
      )}

      {!isLocked && sortedEnrolments.length > 0 && (
        <form action={submitWithId} className="mt-3">
          <button type="submit" className="text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-4 py-2 transition-colors">
            Submit for Approval
          </button>
        </form>
      )}
    </div>
  )
}