/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { getLmsAccess, todayInSchoolTz, getCurrentAcademicSession } from '@/lib/lms/access'

const GENERIC_ERROR = 'Not found'

// ─── Shared context helper ─────────────────────────────────────────────────────

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  return { supabase, user, schoolId: profile.school_id as string }
}

// ─── Authorization helper ──────────────────────────────────────────────────────

/**
 * Determines whether the caller may access period attendance for a given
 * timetable entry and date.
 *
 * Returns { canMark: true, entry } on success, or { canMark: false } on failure.
 *
 * Authorization rules:
 * - ADMIN (isManager): any past or present date, any LMS entry of the school.
 * - FACILITATOR (isFacilitator): only for entries where teacher_id = user,
 *   delivery_mode = 'lms', session = current, entry.day_of_week == weekday of
 *   `date`, AND date must be today in the school's timezone.
 */
async function authorizeForEntry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string },
  schoolId: string,
  timetableEntryId: string,
  date: string // YYYY-MM-DD
): Promise<{ ok: false } | { ok: true; entry: any; canManage: boolean }> {
  const access = await getLmsAccess(supabase, user as any)

  if (!access.isManager && !access.isFacilitator) return { ok: false }

  // Load entry (scoped to school)
  const { data: entry, error: entryErr } = await (supabase as any)
    .from('timetable_entries')
    .select('id, school_id, session_id, class_id, arm_id, subject_id, teacher_id, delivery_mode, day_of_week')
    .eq('id', timetableEntryId)
    .eq('school_id', schoolId)
    .single()

  if (entryErr || !entry) return { ok: false }
  if (entry.delivery_mode !== 'lms') return { ok: false }

  // Load current session
  const currentSession = await getCurrentAcademicSession(supabase, schoolId)
  if (!currentSession) return { ok: false }
  if (entry.session_id !== currentSession.id) return { ok: false }

  if (access.isManager) {
    return { ok: true, entry, canManage: true }
  }

  // Facilitator checks
  if (entry.teacher_id !== user.id) return { ok: false }

  // The date must be today in the school's timezone
  const { dateStr, dayOfWeek } = todayInSchoolTz(access.schoolTimezone)
  if (date !== dateStr) return { ok: false }
  if (entry.day_of_week !== dayOfWeek) return { ok: false }

  return { ok: true, entry, canManage: false }
}

// ─── Roster helper ────────────────────────────────────────────────────────────

async function getRoster(entry: any, schoolId: string) {
  const admin = createAdminClient()

  // Get current session
  const supabase = await createClient()
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  if (!currentSession) return []

  // Get enrolments for class, filtered by arm
  let enrolQuery = (admin as any)
    .from('enrolments')
    .select('student_id, students:student_id ( id, first_name, last_name, admission_no )')
    .eq('session_id', currentSession.id)
    .eq('class_id', entry.class_id)

  if (entry.arm_id) {
    enrolQuery = enrolQuery.eq('arm_id', entry.arm_id)
  } else {
    enrolQuery = enrolQuery.is('arm_id', null)
  }

  const { data: enrolments } = await enrolQuery
  const students = (enrolments ?? [])
    .map((e: any) => e.students)
    .filter(Boolean)
    .sort((a: any, b: any) => (a.first_name ?? '').localeCompare(b.first_name ?? ''))

  return students as { id: string; first_name: string; last_name: string; admission_no: string }[]
}

// ─── getPeriodRoster ──────────────────────────────────────────────────────────

export type RosterEntry = {
  id: string
  first_name: string
  last_name: string
  admission_no: string
  existingStatusId: string | null
}

export type AttendanceStatus = {
  id: string
  label: string
  code: string
  counts_as_present: boolean
}

export type PeriodRosterResult = {
  ok: false
  error: string
} | {
  ok: true
  className: string
  armName: string | null
  subjectName: string
  date: string
  statuses: AttendanceStatus[]
  roster: RosterEntry[]
}

export async function getPeriodRoster(params: {
  timetableEntryId: string
  date: string
}): Promise<PeriodRosterResult> {
  const { supabase, user, schoolId } = await getContext()
  const auth = await authorizeForEntry(supabase, user, schoolId, params.timetableEntryId, params.date)
  if (!auth.ok) return { ok: false, error: GENERIC_ERROR }

  const { entry } = auth

  // Load class, arm, subject names
  const admin = createAdminClient()
  const [{ data: classRow }, { data: armRow }, { data: subjectRow }] = await Promise.all([
    (admin as any).from('classes').select('name').eq('id', entry.class_id).single(),
    entry.arm_id
      ? (admin as any).from('arms').select('name').eq('id', entry.arm_id).single()
      : Promise.resolve({ data: null }),
    (admin as any).from('subjects').select('name').eq('id', entry.subject_id).single(),
  ])

  // Load attendance statuses for the school
  const { data: statusRows } = await (admin as any)
    .from('attendance_statuses')
    .select('id, label, code, counts_as_present')
    .eq('school_id', schoolId)
    .order('label')

  const statuses: AttendanceStatus[] = statusRows ?? []

  // Get roster
  const roster = await getRoster(entry, schoolId)

  // Load existing marks for (student, date, subject_id) — NOT by entry
  const studentIds = roster.map((s) => s.id)
  const existingMarks: Record<string, string> = {}

  if (studentIds.length > 0) {
    const { data: existing } = await (admin as any)
      .from('lms_period_attendance')
      .select('student_id, status_id')
      .in('student_id', studentIds)
      .eq('subject_id', entry.subject_id)
      .eq('date', params.date)
      .eq('school_id', schoolId)

    for (const m of existing ?? []) {
      existingMarks[m.student_id] = m.status_id
    }
  }

  const rosterWithMarks: RosterEntry[] = roster.map((s) => ({
    ...s,
    existingStatusId: existingMarks[s.id] ?? null,
  }))

  return {
    ok: true,
    className: classRow?.name ?? 'Class',
    armName: armRow?.name ?? null,
    subjectName: subjectRow?.name ?? 'Subject',
    date: params.date,
    statuses,
    roster: rosterWithMarks,
  }
}

// ─── savePeriodAttendance ─────────────────────────────────────────────────────

export type SavePeriodAttendanceResult = {
  ok: false
  error: string
} | {
  ok: true
  marked: number
  total: number
  present: number
}

export async function savePeriodAttendance(params: {
  timetableEntryId: string
  date: string
  marks: { studentId: string; statusId: string }[]
}): Promise<SavePeriodAttendanceResult> {
  const { supabase, user, schoolId } = await getContext()
  const auth = await authorizeForEntry(supabase, user, schoolId, params.timetableEntryId, params.date)
  if (!auth.ok) return { ok: false, error: GENERIC_ERROR }

  const { entry } = auth

  // Build valid roster set
  const roster = await getRoster(entry, schoolId)
  const validStudentIds = new Set(roster.map((s) => s.id))

  // Build valid status set for this school
  const admin = createAdminClient()
  const { data: statusRows } = await (admin as any)
    .from('attendance_statuses')
    .select('id, counts_as_present')
    .eq('school_id', schoolId)

  const validStatusMap = new Map<string, boolean>()
  for (const s of statusRows ?? []) {
    validStatusMap.set(s.id, s.counts_as_present)
  }

  // Find the lesson delivered that day for this class/arm/subject (for lesson_id)
  let deliveryQuery = (admin as any)
    .from('lms_lesson_deliveries')
    .select('id, lesson_id')
    .eq('school_id', schoolId)
    .eq('class_id', entry.class_id)
    .eq('delivered_on', params.date)

  if (entry.arm_id) {
    deliveryQuery = deliveryQuery.eq('arm_id', entry.arm_id)
  } else {
    deliveryQuery = deliveryQuery.is('arm_id', null)
  }

  const { data: deliveries } = await deliveryQuery
  // Find a delivery that is for the same subject (via lms_lessons)
  let lessonId: string | null = null
  if (deliveries && deliveries.length > 0) {
    const lessonIds = deliveries.map((d: any) => d.lesson_id)
    const { data: matchingLesson } = await (admin as any)
      .from('lms_lessons')
      .select('id')
      .in('id', lessonIds)
      .eq('subject_id', entry.subject_id)
      .limit(1)
      .maybeSingle()
    lessonId = matchingLesson?.id ?? null
  }

  // Deduplicate and validate marks
  const seen = new Set<string>()
  const rows: Record<string, unknown>[] = []

  for (const mark of params.marks) {
    if (seen.has(mark.studentId)) continue
    if (!validStudentIds.has(mark.studentId)) continue
    if (!validStatusMap.has(mark.statusId)) continue
    seen.add(mark.studentId)

    rows.push({
      school_id: schoolId,
      class_id: entry.class_id,
      arm_id: entry.arm_id ?? null,
      subject_id: entry.subject_id,
      lesson_id: lessonId,
      student_id: mark.studentId,
      date: params.date,
      status_id: mark.statusId,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    })
  }

  if (rows.length === 0) return { ok: false, error: 'No valid marks to save.' }

  const { data: upserted, error: upsertErr } = await (admin as any)
    .from('lms_period_attendance')
    .upsert(rows, { onConflict: 'student_id,date,subject_id' })
    .select('student_id, status_id')

  if (upsertErr) return { ok: false, error: GENERIC_ERROR }
  if (!upserted || upserted.length === 0) return { ok: false, error: GENERIC_ERROR }

  // Compute counts
  let present = 0
  for (const u of upserted) {
    if (validStatusMap.get(u.status_id)) present++
  }

  await logSchoolAction('lms_period_attendance_saved', {
    metadata: {
      timetableEntryId: params.timetableEntryId,
      date: params.date,
      classId: entry.class_id,
      armId: entry.arm_id,
      subjectId: entry.subject_id,
      marked: upserted.length,
      present,
    },
  })

  revalidatePath('/dashboard/lms/today')

  return {
    ok: true,
    marked: upserted.length,
    total: roster.length,
    present,
  }
}

// ─── getLessonAttendanceSummary ───────────────────────────────────────────────

export type AttendanceSummaryRow = {
  date: string
  present: number
  late: number
  absent: number
  total: number
}

export type LessonAttendanceSummaryResult = {
  ok: false
  error: string
} | {
  ok: true
  rows: AttendanceSummaryRow[]
  canManage: boolean
}

export async function getLessonAttendanceSummary(params: {
  lessonId: string
}): Promise<LessonAttendanceSummaryResult> {
  const { supabase, user, schoolId } = await getContext()

  const [{ data: canManage }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])

  const admin = createAdminClient()

  // Load the lesson (scoped to school)
  const { data: lesson, error: lessonErr } = await (admin as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, recorded_by')
    .eq('id', params.lessonId)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson) return { ok: false, error: GENERIC_ERROR }

  // Authorization: lms.manage, recorded_by, or facilitator with LMS entry for that class+subject
  let allowed = false
  if (canManage) {
    allowed = true
  } else if (lesson.recorded_by === user.id) {
    allowed = true
  } else if (canFacilitate) {
    const { data: currentSession } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()

    if (currentSession) {
      const { data: entries } = await (supabase as any)
        .from('timetable_entries')
        .select('id')
        .eq('school_id', schoolId)
        .eq('session_id', currentSession.id)
        .eq('teacher_id', user.id)
        .eq('delivery_mode', 'lms')
        .eq('class_id', lesson.class_id)
        .eq('subject_id', lesson.subject_id)
        .limit(1)

      if (entries && entries.length > 0) allowed = true
    }
  }

  if (!allowed) return { ok: false, error: GENERIC_ERROR }

  // Load attendance statuses for counting
  const { data: statusRows } = await (admin as any)
    .from('attendance_statuses')
    .select('id, code, label, counts_as_present')
    .eq('school_id', schoolId)

  const statusMap = new Map<string, { code: string; label: string; counts_as_present: boolean }>()
  for (const s of statusRows ?? []) {
    statusMap.set(s.id, s)
  }

  // Load period attendance records for this lesson
  const { data: records } = await (admin as any)
    .from('lms_period_attendance')
    .select('date, status_id')
    .eq('lesson_id', params.lessonId)
    .eq('school_id', schoolId)
    .order('date', { ascending: false })

  // Group by date
  const byDate = new Map<string, { present: number; late: number; absent: number; total: number }>()
  for (const r of records ?? []) {
    const d = r.date
    if (!byDate.has(d)) byDate.set(d, { present: 0, late: 0, absent: 0, total: 0 })
    const bucket = byDate.get(d)!
    bucket.total++
    const s = statusMap.get(r.status_id)
    if (!s) continue
    const code = (s.code || '').toLowerCase()
    const label = (s.label || '').toLowerCase()
    if (s.counts_as_present || code === 'present' || label.includes('present')) {
      bucket.present++
    } else if (code === 'late' || label.includes('late')) {
      bucket.late++
    } else {
      bucket.absent++
    }
  }

  const rows: AttendanceSummaryRow[] = Array.from(byDate.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, counts]) => ({ date, ...counts }))

  return { ok: true, rows, canManage: !!canManage }
}

// ─── getTodayAttendanceChips ──────────────────────────────────────────────────
// Used by Today's Lessons page to compute per-entry "x of y marked" chips.

export type AttendanceChip = {
  timetableEntryId: string
  marked: number
  total: number
}

export async function getTodayAttendanceChips(params: {
  entryIds: string[]
  date: string
}): Promise<{ chips: Record<string, AttendanceChip> }> {
  // This is called server-side from the page component (not a client action),
  // so we re-check school context for data safety.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { chips: {} }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()
  if (!profile) return { chips: {} }

  const schoolId = profile.school_id as string
  const admin = createAdminClient()

  if (params.entryIds.length === 0) return { chips: {} }

  // Load all entries to get their class_id, arm_id, subject_id
  const { data: entries } = await (admin as any)
    .from('timetable_entries')
    .select('id, class_id, arm_id, subject_id')
    .in('id', params.entryIds)
    .eq('school_id', schoolId)

  if (!entries || entries.length === 0) return { chips: {} }

  // For each entry get roster count and marked count
  const chips: Record<string, AttendanceChip> = {}

  // Get current session for roster
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  for (const entry of entries) {
    let total = 0
    let marked = 0

    if (currentSession) {
      // Roster count
      let enrolQuery = (admin as any)
        .from('enrolments')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', currentSession.id)
        .eq('class_id', entry.class_id)

      if (entry.arm_id) {
        enrolQuery = enrolQuery.eq('arm_id', entry.arm_id)
      } else {
        enrolQuery = enrolQuery.is('arm_id', null)
      }

      const { count: rosterCount } = await enrolQuery
      total = rosterCount ?? 0

      // Marked count for today / subject
      let attQuery = (admin as any)
        .from('lms_period_attendance')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', schoolId)
        .eq('subject_id', entry.subject_id)
        .eq('date', params.date)
        .eq('class_id', entry.class_id)

      if (entry.arm_id) {
        attQuery = attQuery.eq('arm_id', entry.arm_id)
      } else {
        attQuery = attQuery.is('arm_id', null)
      }

      const { count: markedCount } = await attQuery
      marked = markedCount ?? 0
    }

    chips[entry.id] = { timetableEntryId: entry.id, marked, total }
  }

  return { chips }
}
