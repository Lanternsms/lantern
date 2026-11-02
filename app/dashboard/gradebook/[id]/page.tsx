import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { saveScores, submitForApproval } from '@/app/dashboard/gradebook/actions'
import Link from 'next/link'
import { CheckCircle2 } from '@/components/icons'

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
    return <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8"><p className="text-sm text-text-secondary">No current term is set.</p></div>
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

  const rows = sortedEnrolments.map((e) => {
    const student = (Array.isArray(e.students) ? e.students[0] : e.students) as StudentRelation | null
    const scores = (assessmentTypes ?? []).map((at) => scoreByKey.get(`${e.student_id}_${at.id}`))
    const filled = scores.filter((v) => v !== undefined && v !== null)
    const complete = assessmentTypes ? filled.length === assessmentTypes.length : false
    const total = filled.reduce((sum: number, v) => sum + Number(v), 0)
    return { e, student, complete, total, any: filled.length > 0 }
  })
  const completeCount = rows.filter((r) => r.complete).length
  const statusLabel = batch ? batch.status.replace(/_/g, ' ') : 'Not started'
  const steps = [
    { label: 'You enter scores', note: `${completeCount} of ${rows.length} complete`, state: isLocked ? 'done' : 'now' },
    { label: 'Head of department checks', note: '', state: isLocked ? 'now' : 'later' },
    { label: 'Principal approves', note: '', state: 'later' },
    { label: 'Guardians see the report card', note: '', state: batch?.status === 'published' ? 'done' : 'later' },
  ]

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
          <Link href="/dashboard/gradebook" className="hover:text-text-primary">Gradebook</Link> / {term.name}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[34px]">
            {cs.subjects?.name} · {cs.classes?.name}{cs.arms?.name ?? ''}
          </h1>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
            batch?.status === 'published' ? 'bg-success-bg text-success-text'
            : batch?.status === 'returned' ? 'bg-warning-bg text-warning-text'
            : isLocked ? 'bg-school-soft text-school-ink' : 'bg-raised text-[#374151]'
          }`}>{statusLabel}</span>
        </div>
        <p className="text-[15px] text-text-secondary">
          {rows.length} students · <strong className="font-semibold text-text-primary">{completeCount} of {rows.length} complete</strong>
          {completeCount < rows.length && !isLocked ? ` — ${rows.length - completeCount} still missing a score` : ''}
        </p>
      </div>

      {error && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">{error}</p>}
      {saved && <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success-text"><CheckCircle2 size={16} /> Scores saved.</p>}
      {submitted && <p role="status" className="flex items-center gap-2 rounded-xl bg-success-bg px-4 py-3 text-sm text-success-text"><CheckCircle2 size={16} /> Sent to your head of department.</p>}
      {isLocked && <p className="rounded-xl bg-school-soft px-4 py-3 text-sm text-school-ink">These scores have been sent up for approval, so they can’t be changed here. Your head of department can return them to you.</p>}

      {rows.length === 0 ? (
        <p className="card p-6 text-text-secondary">No students are enrolled in this class arm this session.</p>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form action={saveScoresWithId} className="card flex min-w-0 flex-col">
            <div className="sm:overflow-x-auto">
              <table className="w-full text-sm max-sm:block sm:min-w-[560px]">
                <thead className="max-sm:hidden">
                  <tr className="text-[13px] text-text-secondary">
                    <th className="px-5 py-3.5 text-left font-medium">Student</th>
                    {assessmentTypes?.map((at) => <th key={at.id} className="px-2 py-3.5 text-right font-medium">{at.name}</th>)}
                    <th className="px-5 py-3.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="max-sm:block">
                  {rows.map(({ e, student, complete, total, any }) => (
                    <tr key={e.student_id} className="border-t border-rule max-sm:grid max-sm:grid-cols-[repeat(auto-fit,minmax(68px,1fr))] max-sm:gap-x-2 max-sm:gap-y-2 max-sm:px-4 max-sm:py-3.5 max-sm:first:border-t-0">
                      <td className="px-5 py-2 max-sm:col-span-full max-sm:p-0">
                        <span className="block font-medium max-sm:text-[15px]">{student ? `${student.first_name} ${student.last_name}` : 'Unknown student'}</span>
                        <span className={`block text-xs ${complete ? 'text-text-secondary' : 'text-warning-text'}`}>{complete ? student?.admission_no : any ? 'Missing a score' : 'No scores yet'}</span>
                      </td>
                      {assessmentTypes?.map((at) => {
                        const v = scoreByKey.get(`${e.student_id}_${at.id}`)
                        const empty = v === undefined || v === null
                        return (
                          <td key={at.id} className="px-2 py-2 text-right max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:p-0 max-sm:text-left">
                            <span aria-hidden className="truncate text-xs text-text-secondary sm:hidden">{at.name}</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              min="0"
                              max="100"
                              aria-label={`${at.name}, ${student?.first_name ?? ''} ${student?.last_name ?? ''}`}
                              disabled={!!isLocked}
                              name={`score_${e.student_id}_${at.id}`}
                              defaultValue={v ?? ''}
                              className={`h-12 w-full rounded-lg border px-2.5 text-center sm:h-10 sm:w-[72px] sm:text-right text-[15px] tabular-nums focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft disabled:border-transparent disabled:bg-raised disabled:text-text-secondary ${empty && any && !isLocked ? 'border-danger-text/40 bg-danger-bg/40' : 'border-control bg-surface'}`}
                            />
                          </td>
                        )
                      })}
                      <td className="px-5 py-2 text-right font-display text-[17px] font-semibold tabular-nums max-sm:flex max-sm:flex-col max-sm:gap-1 max-sm:p-0 max-sm:text-left">
                        <span aria-hidden className="font-sans text-xs font-normal text-text-secondary sm:hidden">Total</span>
                        <span className="max-sm:flex max-sm:h-12 max-sm:items-center max-sm:justify-center max-sm:rounded-lg max-sm:bg-raised">{any ? total : '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isLocked && (
              <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-0 flex items-center justify-between gap-3 rounded-b-[18px] border-t border-rule bg-surface/95 px-5 py-3.5 backdrop-blur">
                <span className="text-sm text-text-secondary">Totals update when you save.</span>
                <button type="submit" className="h-11 shrink-0 rounded-xl bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-hover sm:h-10 sm:border sm:border-control sm:bg-surface sm:px-4 sm:text-text-primary sm:hover:bg-raised">Save scores</button>
              </div>
            )}
          </form>

          <aside className="flex flex-col gap-4">
            <section aria-labelledby="chain" className="card p-5">
              <h2 id="chain" className="mb-4 text-[15px] font-semibold">Where these scores go</h2>
              <ol className="flex flex-col gap-4">
                {steps.map((st) => (
                  <li key={st.label} className="flex gap-3">
                    <span className={`mt-0.5 h-5 w-5 shrink-0 rounded-full ${st.state === 'done' ? 'bg-primary' : st.state === 'now' ? 'border-[5px] border-primary' : 'border border-control'}`} />
                    <span className="flex flex-col">
                      <span className={st.state === 'later' ? 'text-text-secondary' : 'font-semibold'}>{st.label}</span>
                      {st.note && <span className="text-xs text-text-secondary">{st.note}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            {!isLocked && (
              <form action={submitWithId} className="flex flex-col gap-2 rounded-[24px] bg-school-deep p-5 text-white shadow-raise">
                <span className="font-semibold">Ready to send?</span>
                <span className="text-sm text-school-deep-muted">
                  {completeCount === rows.length ? 'Every student has a complete set of scores.' : `${rows.length - completeCount} student${rows.length - completeCount === 1 ? '' : 's'} still missing a score. Save first, then send.`}
                </span>
                <button type="submit" className="mt-2 h-11 rounded-xl bg-white text-sm font-semibold text-school-deep hover:bg-school-soft">Send to head of department</button>
              </form>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
