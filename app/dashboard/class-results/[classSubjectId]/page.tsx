import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { PrintButton } from '@/components/print-button'

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

type StudentRow = {
  studentId: string
  name: string
  admissionNo: string
  subjectTotals: Record<string, number>          // subjectId → total score
  grandTotal: number
  average: number
  rank: number | null
  grade: string | null
}

type SubjectStat = {
  subjectId: string
  subjectName: string
  classAverage: number
  highest: number
  lowest: number
  gradeCounts: Record<string, number>            // grade label → count
}

type GradeBand = { min_score: number; max_score: number; grade: string; remark: string | null }

function gradeFor(total: number, bands: GradeBand[]): string | null {
  const b = bands.find((b) => total >= b.min_score && total <= b.max_score)
  return b?.grade ?? null
}

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default async function ClassResultDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ classSubjectId: string }>
  searchParams: Promise<{ term?: string }>
}) {
  const { classSubjectId } = await params
  const { term: termId } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  // Class-subject assignment (verify teacher owns it)
  const { data: cs, error: csError } = await supabase
    .from('class_subjects')
    .select('id, class_id, arm_id, subject_id, session_id, classes(name), arms(name), subjects(name)')
    .eq('id', classSubjectId)
    .eq('teacher_id', user.id)
    .single()

  if (csError || !cs) notFound()

  // Terms list (for selector)
  const { data: terms } = await supabase
    .from('terms')
    .select('id, name, is_current, session_id, start_date, academic_sessions(name)')
    .order('start_date', { ascending: false })

  const selectedTerm = termId
    ? terms?.find((t) => t.id === termId)
    : terms?.find((t) => t.is_current) ?? terms?.[0]

  if (!selectedTerm) {
    return (
      <div className="px-8 py-8">
        <Link href="/dashboard/class-results" className="text-sm text-primary hover:text-primary-hover">
          ← Back to Class Results
        </Link>
        <p className="text-sm text-text-secondary mt-6">No current term is configured.</p>
      </div>
    )
  }

  // Grading scale
  const { data: scale } = await supabase
    .from('grading_scales')
    .select('id')
    .eq('school_id', profile.school_id)
    .eq('is_default', true)
    .maybeSingle()

  const { data: bands } = scale
    ? await supabase
        .from('grade_bands')
        .select('min_score, max_score, grade, remark')
        .eq('scale_id', scale.id)
        .order('min_score', { ascending: false })
    : { data: [] as GradeBand[] }

  const gradeBands: GradeBand[] = (bands ?? []) as GradeBand[]

  // Enrolled students for this class in this term's session
  const { data: enrolments } = await supabase
    .from('enrolments')
    .select('student_id, students(first_name, last_name, admission_no)')
    .eq('session_id', selectedTerm.session_id)
    .eq('class_id', cs.class_id)

  if (!enrolments || enrolments.length === 0) {
    return (
      <div className="px-8 py-8">
        <Link href="/dashboard/class-results" className="text-sm text-primary hover:text-primary-hover">
          ← Back to Class Results
        </Link>
        <h1 className="text-xl font-semibold text-text-primary mt-4 mb-1">
          {(cs.subjects as { name: string } | null)?.name} —{' '}
          {(cs.classes as { name: string } | null)?.name}
          {(cs.arms as { name: string } | null)?.name
            ? ` ${(cs.arms as { name: string }).name}`
            : ''}
        </h1>
        <p className="text-sm text-text-secondary">No students enrolled in this class for {selectedTerm.name}.</p>
      </div>
    )
  }

  // Published results for this subject, term, class
  const studentIds = enrolments.map((e) => e.student_id)

  const { data: rawResults } = await supabase
    .from('results')
    .select('student_id, subject_id, score, subjects(name), assessment_types(name), result_batches!inner(status)')
    .in('student_id', studentIds)
    .eq('term_id', selectedTerm.id)
    .eq('subject_id', cs.subject_id)
    .eq('result_batches.status', 'published')

  // Aggregate per student: sum all assessment scores for this subject
  const totalsMap = new Map<string, number>()
  for (const r of rawResults ?? []) {
    totalsMap.set(r.student_id, (totalsMap.get(r.student_id) ?? 0) + r.score)
  }

  // Build student rows
  const subjectName = (cs.subjects as { name: string } | null)?.name ?? ''

  const studentRows: StudentRow[] = enrolments
    .map((e) => {
      const total = totalsMap.get(e.student_id) ?? 0
      const student = e.students as { first_name: string; last_name: string; admission_no: string } | null
      return {
        studentId: e.student_id,
        name: `${student?.first_name ?? ''} ${student?.last_name ?? ''}`.trim(),
        admissionNo: student?.admission_no ?? '',
        subjectTotals: { [cs.subject_id]: total },
        grandTotal: total,
        average: total,
        rank: null,
        grade: gradeFor(total, gradeBands),
      }
    })
    .sort((a, b) => b.grandTotal - a.grandTotal)

  // Assign ranks (same score → same rank)
  let currentRank = 1
  for (let i = 0; i < studentRows.length; i++) {
    if (i > 0 && studentRows[i].grandTotal < studentRows[i - 1].grandTotal) {
      currentRank = i + 1
    }
    studentRows[i].rank = currentRank
  }

  // Per-subject statistics (for this single subject)
  const scores = studentRows.map((s) => s.grandTotal)
  const classAverage = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  const highest = scores.length > 0 ? Math.max(...scores) : 0
  const lowest = scores.length > 0 ? Math.min(...scores) : 0

  // Grade distribution
  const gradeCounts: Record<string, number> = {}
  for (const s of studentRows) {
    const g = s.grade ?? 'N/A'
    gradeCounts[g] = (gradeCounts[g] ?? 0) + 1
  }

  const subjectStat: SubjectStat = {
    subjectId: cs.subject_id,
    subjectName,
    classAverage: Math.round(classAverage * 10) / 10,
    highest,
    lowest,
    gradeCounts,
  }

  // Grade labels ordered by band
  const gradeLabels = gradeBands.map((b) => b.grade)

  const classLabel =
    `${(cs.classes as { name: string } | null)?.name ?? ''}` +
    ((cs.arms as { name: string } | null)?.name ? ` ${(cs.arms as { name: string }).name}` : '')

  const sessionName = (selectedTerm.academic_sessions as { name: string } | null)?.name ?? ''

  // Score ranges for colour coding
  function scoreColour(score: number): string {
    if (!gradeBands.length) return 'text-text-primary'
    const band = gradeBands.find((b) => score >= b.min_score && score <= b.max_score)
    if (!band) return 'text-text-secondary'
    const pct = (score - gradeBands[gradeBands.length - 1].min_score) / (gradeBands[0].max_score - gradeBands[gradeBands.length - 1].min_score)
    if (pct >= 0.7) return 'text-success-text font-semibold'
    if (pct >= 0.4) return 'text-text-primary'
    return 'text-danger-text'
  }

  return (
    <div className="px-8 py-8 max-w-6xl print:px-4 print:py-4">
      {/* ── Breadcrumb ── */}
      <Link
        href="/dashboard/class-results"
        className="text-sm text-primary hover:text-primary-hover print:hidden"
      >
        ← Back to Class Results
      </Link>

      {/* ── Header ── */}
      <div className="flex items-start justify-between mt-4 mb-6 print:mt-0">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {subjectName} — {classLabel}
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {selectedTerm.name}
            {sessionName ? ` · ${sessionName}` : ''}
            {' · '}
            {studentRows.length} student{studentRows.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 print:hidden">
          {/* Term switcher */}
          {terms && terms.length > 1 && (
            <form method="GET">
              <select
                name="term"
                defaultValue={selectedTerm.id}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                onChange={undefined}
              >
                {terms.map((t) => {
                  const s = t.academic_sessions as { name: string } | null
                  return (
                    <option key={t.id} value={t.id}>
                      {t.name}{s ? ` — ${s.name}` : ''}{t.is_current ? ' (Current)' : ''}
                    </option>
                  )
                })}
              </select>
              <button
                type="submit"
                className="ml-2 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg px-3 py-1.5 transition-colors"
              >
                Go
              </button>
            </form>
          )}
          <PrintButton label="Print Summary" />
        </div>
      </div>

      {/* ── Stats summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Class Average', value: subjectStat.classAverage.toFixed(1) },
          { label: 'Highest Score', value: subjectStat.highest.toFixed(1) },
          { label: 'Lowest Score', value: subjectStat.lowest.toFixed(1) },
          { label: 'Students', value: studentRows.length },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface border border-border rounded-xl px-5 py-4"
          >
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-1">
              {card.label}
            </p>
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Grade Distribution ── */}
      {gradeLabels.length > 0 && (
        <div className="bg-surface border border-border rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Grade Distribution</h2>
          <div className="flex items-end gap-3 flex-wrap">
            {gradeLabels.map((g) => {
              const count = subjectStat.gradeCounts[g] ?? 0
              const pct = studentRows.length > 0 ? (count / studentRows.length) * 100 : 0
              return (
                <div key={g} className="flex flex-col items-center gap-1 min-w-[40px]">
                  <span className="text-xs font-semibold text-text-primary">{count}</span>
                  <div
                    className="w-10 bg-primary/20 rounded-t-md transition-all"
                    style={{ height: `${Math.max(pct, 2)}px`, minHeight: '4px' }}
                    title={`${pct.toFixed(1)}%`}
                  />
                  <span className="text-xs text-text-secondary font-medium">{g}</span>
                  <span className="text-xs text-text-muted">{pct.toFixed(0)}%</span>
                </div>
              )
            })}
            {/* N/A slot */}
            {subjectStat.gradeCounts['N/A'] !== undefined && (
              <div className="flex flex-col items-center gap-1 min-w-[40px]">
                <span className="text-xs font-semibold text-text-primary">
                  {subjectStat.gradeCounts['N/A']}
                </span>
                <div
                  className="w-10 bg-text-muted/20 rounded-t-md"
                  style={{
                    height: `${Math.max((subjectStat.gradeCounts['N/A'] / studentRows.length) * 100, 2)}px`,
                    minHeight: '4px',
                  }}
                />
                <span className="text-xs text-text-secondary font-medium">N/A</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Student result table ── */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Student Scores</h2>
          <span className="text-xs text-text-secondary">
            Only published results are shown
          </span>
        </div>

        {rawResults && rawResults.length === 0 ? (
          <p className="text-sm text-text-secondary px-5 py-6">
            No published results for this subject and term yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide w-8">
                  #
                </th>
                <th className="text-left font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Student
                </th>
                <th className="text-right font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Score
                </th>
                <th className="text-center font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Grade
                </th>
                <th className="text-center font-medium text-text-secondary px-4 py-3 text-xs uppercase tracking-wide">
                  Rank
                </th>
              </tr>
            </thead>
            <tbody>
              {studentRows.map((s, idx) => (
                <tr
                  key={s.studentId}
                  className={`border-b border-border last:border-0 ${
                    idx % 2 === 0 ? '' : 'bg-surface-muted/20'
                  }`}
                >
                  <td className="px-4 py-3 text-text-muted text-xs">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-text-primary">{s.name}</span>
                    <span className="block text-xs text-text-secondary">{s.admissionNo}</span>
                  </td>
                  <td className={`px-4 py-3 text-right tabular-nums ${scoreColour(s.grandTotal)}`}>
                    {totalsMap.has(s.studentId) ? s.grandTotal.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.grade ? (
                      <span className="inline-flex items-center justify-center text-xs font-semibold bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
                        {s.grade}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.rank !== null ? (
                      <span
                        className={`text-xs font-semibold ${
                          s.rank === 1
                            ? 'text-yellow-600'
                            : s.rank === 2
                            ? 'text-slate-500'
                            : s.rank === 3
                            ? 'text-amber-700'
                            : 'text-text-secondary'
                        }`}
                      >
                        {s.rank}
                        {s.rank === 1 ? ' 🥇' : s.rank === 2 ? ' 🥈' : s.rank === 3 ? ' 🥉' : ''}
                      </span>
                    ) : (
                      <span className="text-text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Print footer */}
      <p className="hidden print:block text-xs text-text-secondary mt-6 text-center">
        Printed from Lantern · {subjectName} · {classLabel} · {selectedTerm.name}
      </p>
    </div>
  )
}
