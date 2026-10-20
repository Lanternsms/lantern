// app/dashboard/lms/access.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { logSchoolAction } from '@/lib/audit/log-school-actions'

/** Shared context helper */
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

  return { supabase, user, schoolId: profile.school_id }
}

/**
 * Verify that the caller is allowed to ask a question about a lesson for a given student.
 * Returns null on failure, otherwise { kind: 'guardian'|'student', lesson }.
 */
export async function getAskerAccess(
  userId: string,
  lessonId: string,
  studentId: string
): Promise<
  | { kind: 'guardian' | 'student'; lesson: any }
  | null
> {
  const { supabase, schoolId } = await getContext()

  // Load lesson – must be published with video_path
  const { data: lesson, error: lessonErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, video_path')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson || lesson.status !== 'published' || !lesson.video_path) {
    return null
  }

  // Determine if caller is the student
  const { data: selfStudent } = await supabase
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('profile_id', userId)
    .eq('school_id', schoolId)
    .maybeSingle()

  let kind: 'guardian' | 'student' | null = null
  if (selfStudent) {
    kind = 'student'
  } else {
    // Maybe guardian?
    const { data: guardianRow } = await supabase
      .from('guardians')
      .select('id')
      .eq('profile_id', userId)
      .eq('school_id', schoolId)
      .maybeSingle()
    if (guardianRow) {
      const { data: link } = await supabase
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardianRow.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (link) kind = 'guardian'
    }
  }

  if (!kind) return null

  // Verify student's enrolment in the CURRENT session matches lesson.class_id
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()
  if (!currentSession) return null

  const { data: enrolment } = await supabase
    .from('enrolments')
    .select('class_id')
    .eq('student_id', studentId)
    .eq('session_id', currentSession.id)
    .maybeSingle()

  if (!enrolment || enrolment.class_id !== lesson.class_id) return null

  return { kind, lesson }
}

/**
 * Determine if the user can answer (reply to) a given lesson.
 * "lesson" should be the full lesson row (at least include class_id, subject_id, recorded_by).
 */
export async function canAnswerLesson(userId: string, lesson: any): Promise<boolean> {
  const { supabase, schoolId } = await getContext()

  const [{ data: canManage }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' })
  ])

  if (canManage) return true

  if (lesson.recorded_by === userId) return true

  if (canFacilitate) {
    const { data: currentSession } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()
    if (!currentSession) return false

    const { data: entries } = await (supabase as any)
      .from('timetable_entries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('session_id', currentSession.id)
      .eq('teacher_id', userId)
      .eq('delivery_mode', 'lms')
      .eq('class_id', lesson.class_id)
      .eq('subject_id', lesson.subject_id)
      .limit(1)

    if (entries && entries.length > 0) return true
  }

  return false
}

/**
 * Get the set of lesson IDs that the user may answer.
 * Returns an array of lesson IDs (strings).
 */
export async function getAnswerableLessonIds(userId: string): Promise<string[]> {
  const { supabase, schoolId } = await getContext()

  const [{ data: canManage }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' })
  ])

  if (canManage) {
    const { data: all } = await (supabase as any)
      .from('lms_lessons')
      .select('id')
      .eq('school_id', schoolId)
    return (all ?? []).map((row: any) => row.id)
  }

  const { data: recorded } = await (supabase as any)
    .from('lms_lessons')
    .select('id')
    .eq('recorded_by', userId)
    .eq('school_id', schoolId)
  const recordedIds = (recorded ?? []).map((r: any) => r.id)

  if (!canFacilitate) return recordedIds

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!currentSession) return recordedIds

  const admin = createAdminClient() as any
  const { data: entries } = await admin
    .from('timetable_entries')
    .select('class_id, subject_id')
    .eq('school_id', schoolId)
    .eq('session_id', currentSession.id)
    .eq('teacher_id', userId)
    .eq('delivery_mode', 'lms')

  if (!entries || entries.length === 0) return recordedIds

  const pairs = new Set(entries.map((e: any) => `${e.class_id}:${e.subject_id}`))

  const { data: lessons } = await (supabase as any)
    .from('lms_lessons')
    .select('id, class_id, subject_id')
    .eq('school_id', schoolId)

  const facilIds = (lessons ?? [])
    .filter((l: any) => pairs.has(`${l.class_id}:${l.subject_id}`))
    .map((l: any) => l.id)

  const allIds = new Set([...recordedIds, ...facilIds])
  return Array.from(allIds)
}

/**
 * Determine if a user can manage activities (quizzes/assignments) for a lesson.
 * Allowed: lms.manage OR the lesson's recorded_by === userId.
 */
export async function canManageActivities(userId: string, lessonOrId: any): Promise<boolean> {
  const { supabase, schoolId } = await getContext()

  const { data: canManage } = await supabase.rpc('has_permission', { perm_code: 'lms.manage' })
  if (canManage) return true

  let lesson = lessonOrId
  if (typeof lessonOrId === 'string') {
    const admin = createAdminClient()
    const { data } = await (admin as any)
      .from('lms_lessons')
      .select('id, school_id, recorded_by, class_id, subject_id')
      .eq('id', lessonOrId)
      .eq('school_id', schoolId)
      .maybeSingle()
    lesson = data
  }

  if (!lesson) return false
  return lesson.recorded_by === userId
}

/**
 * Determine if a user can view activity results/submissions for a lesson.
 * Allowed: canManageActivities OR (lms.facilitate + matching timetable_entries delivery_mode='lms')
 */
export async function canViewActivityResults(userId: string, lessonOrId: any): Promise<boolean> {
  if (await canManageActivities(userId, lessonOrId)) return true

  const { supabase, schoolId } = await getContext()
  const { data: canFacilitate } = await supabase.rpc('has_permission', { perm_code: 'lms.facilitate' })
  if (!canFacilitate) return false

  let lesson = lessonOrId
  if (typeof lessonOrId === 'string' || !lesson.class_id || !lesson.subject_id) {
    const admin = createAdminClient()
    const id = typeof lessonOrId === 'string' ? lessonOrId : lessonOrId.id
    const { data } = await (admin as any)
      .from('lms_lessons')
      .select('id, school_id, recorded_by, class_id, subject_id')
      .eq('id', id)
      .eq('school_id', schoolId)
      .maybeSingle()
    lesson = data
  }

  if (!lesson) return false

  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  if (!currentSession) return false

  const { data: entries } = await (supabase as any)
    .from('timetable_entries')
    .select('id')
    .eq('school_id', schoolId)
    .eq('session_id', currentSession.id)
    .eq('teacher_id', userId)
    .eq('delivery_mode', 'lms')
    .eq('class_id', lesson.class_id)
    .eq('subject_id', lesson.subject_id)
    .limit(1)

  return !!(entries && entries.length > 0)
}

