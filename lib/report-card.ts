import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ReportCardSubject = {
  subjectId: string
  subjectName: string
  scores: Record<string, number>
  total: number
  grade: string | null
  remark: string | null
}

export type ReportCard = {
  student: { id: string; first_name: string; last_name: string; admission_no: string }
  term: { id: string; name: string }
  session: { name: string }
  classLabel: string
  subjects: ReportCardSubject[]
  assessmentNames: string[]
  overallTotal: number
  overallAverage: number
  rank: number | null
  classSize: number | null
  rankingEnabled: boolean
  showRankToViewer: boolean
  classTeacherRemark: string | null
  principalRemark: string | null
}

export function sortAssessmentNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const isExamA = /exam/i.test(a)
    const isExamB = /exam/i.test(b)
    if (isExamA && !isExamB) return 1
    if (!isExamA && isExamB) return -1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

// Builds a report card from PUBLISHED results only — this is deliberate,
// not a filter of convenience. A draft or in-review score has not cleared
// the school's approval chain and should never appear here, even to an
// admin, since this page represents the official record.
export async function buildReportCard(
  supabase: SupabaseClient,
  schoolId: string,
  studentId: string,
  termId: string,
  viewerIsStudentOrParent: boolean
): Promise<ReportCard | null> {
  const { data: student } = await supabase
    .from('students')
    .select('id, first_name, last_name, admission_no')
    .eq('id', studentId)
    .single()
  if (!student) return null

  const { data: term } = await supabase.from('terms').select('id, name, session_id').eq('id', termId).single()
  if (!term) return null

  const { data: session } = await supabase.from('academic_sessions').select('name').eq('id', term.session_id).single()

  const { data: enrolment } = await supabase
    .from('enrolments')
    .select('class_id, arm_id, classes(name), arms(name)')
    .eq('student_id', studentId)
    .eq('session_id', term.session_id)
    .maybeSingle()

  const enrolmentClasses = enrolment?.classes as { name: string } | null | undefined
  const enrolmentArms = enrolment?.arms as { name: string } | null | undefined

  const classLabel = enrolment
    ? `${enrolmentClasses?.name ?? ''}${enrolmentArms?.name ? ' ' + enrolmentArms.name : ''}`
    : '—'

  const { data: results } = await supabase
    .from('results')
    .select('score, subject_id, subjects(name), assessment_types(name), result_batches!inner(status)')
    .eq('student_id', studentId)
    .eq('term_id', termId)
    .eq('result_batches.status', 'published')

  const allAssessmentNames = new Set<string>()
  const bySubject = new Map<string, ReportCardSubject>()
  for (const r of (results ?? []) as any[]) {
    const key = r.subject_id
    if (!bySubject.has(key)) {
      bySubject.set(key, { subjectId: key, subjectName: r.subjects?.name ?? '', scores: {}, total: 0, grade: null, remark: null })
    }
    const entry = bySubject.get(key)!
    const atName = r.assessment_types?.name ?? ''
    if (atName) allAssessmentNames.add(atName)
    entry.scores[atName] = r.score
    entry.total += r.score
  }

  const assessmentNames = sortAssessmentNames([...allAssessmentNames])

  // Ensure each subject's scores object has its keys in the sorted order (CA1, CA2, ..., Exam)
  for (const entry of bySubject.values()) {
    const orderedScores: Record<string, number> = {}
    for (const name of assessmentNames) {
      if (name in entry.scores) {
        orderedScores[name] = entry.scores[name]
      }
    }
    entry.scores = orderedScores
  }

  const { data: scale } = await supabase
    .from('grading_scales')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_default', true)
    .maybeSingle()

  const { data: bands } = scale
    ? await supabase.from('grade_bands').select('min_score, max_score, grade, remark').eq('scale_id', scale.id)
    : { data: [] as { min_score: number; max_score: number; grade: string; remark: string | null }[] }

  function gradeFor(total: number) {
    const band = (bands ?? []).find((b) => total >= b.min_score && total <= b.max_score)
    return band ? { grade: band.grade, remark: band.remark } : { grade: null, remark: null }
  }

  const subjects = [...bySubject.values()]
    .map((s) => ({ ...s, ...gradeFor(s.total) }))
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName))

  const overallTotal = subjects.reduce((sum, s) => sum + s.total, 0)
  const overallAverage = subjects.length > 0 ? overallTotal / subjects.length : 0

  const { data: rules } = await supabase
    .from('result_computation_rules')
    .select('ranking_enabled, rank_by, show_rank_to_students, show_rank_to_parents')
    .eq('school_id', schoolId)
    .maybeSingle()

  const rankingEnabled = rules?.ranking_enabled ?? true
  const rankBy = rules?.rank_by ?? 'average'

  // Staff always see rank if ranking is on at all — the visibility
  // toggles in result_computation_rules only govern what a STUDENT or
  // PARENT sees, not what a teacher/admin reviewing the record sees.
  const showRankToViewer = viewerIsStudentOrParent
    ? (rules?.show_rank_to_students ?? true) || (rules?.show_rank_to_parents ?? true)
    : true

  let rank: number | null = null
  let classSize: number | null = null

  if (rankingEnabled && enrolment) {
    const { data: classmates } = await supabase
      .from('enrolments')
      .select('student_id')
      .eq('session_id', term.session_id)
      .eq('class_id', enrolment.class_id)

    const scoresByStudent: { studentId: string; value: number }[] = []

    // One query per classmate — acceptable for a class of 20-40 students
    // during testing, but a real N+1 pattern worth revisiting (a single
    // grouped query) before this runs against a school's full roster.
    for (const cm of classmates ?? []) {
      const { data: cmResults } = await supabase
        .from('results')
        .select('score, subject_id, result_batches!inner(status)')
        .eq('student_id', cm.student_id)
        .eq('term_id', termId)
        .eq('result_batches.status', 'published')

      const subjectTotals = new Map<string, number>()
      for (const r of cmResults ?? []) {
        subjectTotals.set(r.subject_id, (subjectTotals.get(r.subject_id) ?? 0) + r.score)
      }
      const total = [...subjectTotals.values()].reduce((a, b) => a + b, 0)
      const average = subjectTotals.size > 0 ? total / subjectTotals.size : 0
      scoresByStudent.push({ studentId: cm.student_id, value: rankBy === 'total' ? total : average })
    }

    scoresByStudent.sort((a, b) => b.value - a.value)
    const position = scoresByStudent.findIndex((s) => s.studentId === studentId)
    rank = position >= 0 ? position + 1 : null
    classSize = scoresByStudent.length
  }

  const { data: remarks } = await supabase
    .from('result_remarks')
    .select('class_teacher_remark, principal_remark')
    .eq('student_id', studentId)
    .eq('term_id', termId)
    .maybeSingle()

  return {
    student,
    term: { id: term.id, name: term.name },
    session: { name: session?.name ?? '' },
    classLabel,
    subjects,
    assessmentNames,
    overallTotal,
    overallAverage: Math.round(overallAverage * 10) / 10,
    rank,
    classSize,
    rankingEnabled,
    showRankToViewer,
    classTeacherRemark: remarks?.class_teacher_remark ?? null,
    principalRemark: remarks?.principal_remark ?? null,
  }
}
