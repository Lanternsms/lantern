import 'server-only'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'

export interface LmsAccessContext {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string; email?: string }
  userId: string
  schoolId: string
  schoolTimezone: string
  isManager: boolean
  isFacilitator: boolean
  recordedLessonCount: number
}

/**
 * Computes today's date string and day-of-week index in the school's timezone.
 * Uses Intl.DateTimeFormat (never new Date().toISOString().slice(0, 10)).
 * Day of week convention: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday (matches timetable_entries).
 *
 * @param schoolTimezone Timezone identifier (default 'Africa/Lagos')
 * @param refDate Optional Date instance for boundary and timezone testing
 */
export function todayInSchoolTz(
  schoolTimezone: string | null = 'Africa/Lagos',
  refDate: Date = new Date()
): { dateStr: string; dayOfWeek: number } {
  const tz = schoolTimezone?.trim() || 'Africa/Lagos'

  // Format YYYY-MM-DD
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const dateStr = formatter.format(refDate)

  // Format weekday name
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  })
  const weekdayStr = weekdayFormatter.format(refDate)
  const map: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  }
  const dayOfWeek = map[weekdayStr] ?? 1

  return { dateStr, dayOfWeek }
}

/**
 * Single source of truth for the calling user's LMS permissions, roles, and school context.
 */
export async function getLmsAccess(
  providedClient?: Awaited<ReturnType<typeof createClient>>,
  providedUser?: { id: string; email?: string }
): Promise<LmsAccessContext> {
  const supabase = providedClient ?? (await createClient())
  let user = providedUser

  if (!user) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    if (!authUser) redirect('/login')
    user = authUser
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) redirect('/login')
  const schoolId = profile.school_id

  // Fetch school timezone setting if configured, fallback to Africa/Lagos
  let schoolTimezone = 'Africa/Lagos'
  const { data: school } = await supabase
    .from('schools')
    .select('*')
    .eq('id', schoolId)
    .maybeSingle()

  if ((school as any)?.timezone) {
    schoolTimezone = (school as any).timezone
  }

  // Check permissions: ADMIN = anyone with lms.manage or lms.upload
  const [{ data: canManage }, { data: canUpload }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.upload' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])

  const isManager = Boolean(canManage || canUpload)
  const isFacilitator = Boolean(canFacilitate)

  // Count lessons where caller is recorded_by in their school
  const admin = createAdminClient()
  const { count } = await (admin as any)
    .from('lms_lessons')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .eq('recorded_by', user.id)

  const recordedLessonCount = count ?? 0

  return {
    supabase,
    user,
    userId: user.id,
    schoolId,
    schoolTimezone,
    isManager,
    isFacilitator,
    recordedLessonCount,
  }
}

/**
 * Load current academic session for the given school.
 */
export async function getCurrentAcademicSession(
  client: any,
  schoolId: string
): Promise<{ id: string; name: string } | null> {
  const { data } = await client
    .from('academic_sessions')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()
  return data ?? null
}

/**
 * Helper to check if a facilitator has a scheduled LMS entry for today matching
 * this lesson's class, arm (if applicable), and subject.
 */
export async function facilitatorHasTodayEntryForLesson(
  access: LmsAccessContext,
  lesson: { class_id: string; subject_id: string; school_id?: string },
  refDate?: Date
): Promise<boolean> {
  if (!access.isFacilitator) return false

  const admin = createAdminClient()
  const currentSession = await getCurrentAcademicSession(admin, access.schoolId)
  if (!currentSession) return false

  const { dayOfWeek } = todayInSchoolTz(access.schoolTimezone, refDate)

  // Query timetable entries for this facilitator today with delivery_mode = 'lms'
  // and matching class & subject
  const { data: entries } = await (admin as any)
    .from('timetable_entries')
    .select('id, arm_id')
    .eq('school_id', access.schoolId)
    .eq('session_id', currentSession.id)
    .eq('teacher_id', access.userId)
    .eq('delivery_mode', 'lms')
    .eq('class_id', lesson.class_id)
    .eq('subject_id', lesson.subject_id)
    .eq('day_of_week', dayOfWeek)

  return Boolean(entries && entries.length > 0)
}

/**
 * Helper to check student or guardian enrollment access for a lesson.
 */
export async function getAskerAccess(
  userId: string,
  lessonId: string,
  studentId: string
): Promise<{ kind: 'guardian' | 'student'; lesson: any } | null> {
  const admin = createAdminClient()

  // Load lesson
  const { data: lesson, error: lessonErr } = await (admin as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, video_path, title, topic, ai_tutor_enabled, classes:class_id(name), subjects:subject_id(name)')
    .eq('id', lessonId)
    .maybeSingle()

  if (lessonErr || !lesson || lesson.status !== 'published') {
    return null
  }

  // Check student self-access
  const { data: selfStudent } = await admin
    .from('students')
    .select('id')
    .eq('id', studentId)
    .eq('profile_id', userId)
    .eq('school_id', lesson.school_id)
    .maybeSingle()

  let kind: 'guardian' | 'student' | null = null
  if (selfStudent) {
    kind = 'student'
  } else {
    // Check guardian access
    const { data: guardianRow } = await admin
      .from('guardians')
      .select('id')
      .eq('profile_id', userId)
      .eq('school_id', lesson.school_id)
      .maybeSingle()

    if (guardianRow) {
      const { data: link } = await admin
        .from('student_guardians')
        .select('student_id')
        .eq('guardian_id', guardianRow.id)
        .eq('student_id', studentId)
        .maybeSingle()
      if (link) kind = 'guardian'
    }
  }

  if (!kind) return null

  // Verify student enrolment in current session matches lesson's class
  const currentSession = await getCurrentAcademicSession(admin, lesson.school_id)
  if (!currentSession) return null

  const { data: enrolment } = await admin
    .from('enrolments')
    .select('class_id')
    .eq('student_id', studentId)
    .eq('session_id', currentSession.id)
    .maybeSingle()

  if (!enrolment || enrolment.class_id !== lesson.class_id) {
    return null
  }

  return { kind, lesson }
}

/**
 * Can caller manage (create, edit, delete, upload/replace video) this lesson?
 * Rule: Managers (lms.manage or lms.upload) ONLY.
 * Recorders and Facilitators CANNOT manage lessons.
 */
export function canManageLesson(
  lesson: { school_id: string },
  access: LmsAccessContext
): boolean {
  if (!access.isManager) return false
  return lesson.school_id === access.schoolId
}

/**
 * Can caller view lesson details page / read lesson?
 * - Manager: any lesson in school
 * - Recorder: only where recorded_by = user.id
 * - Facilitator: only published lessons matching an LMS timetable entry for TODAY
 * - Student/Guardian: handled via getAskerAccess
 */
export async function canViewLesson(
  lesson: {
    id: string
    school_id: string
    class_id: string
    subject_id: string
    status: string
    recorded_by?: string | null
  },
  access: LmsAccessContext,
  options?: { studentId?: string; refDate?: Date }
): Promise<boolean> {
  if (lesson.school_id !== access.schoolId) return false

  // 1. Manager sees all lessons in the school
  if (access.isManager) return true

  // 2. Recorder sees own recorded lessons
  if (lesson.recorded_by === access.userId) return true

  // 3. Facilitator sees only published lessons scheduled for them TODAY
  if (access.isFacilitator && lesson.status === 'published') {
    const matchesToday = await facilitatorHasTodayEntryForLesson(access, lesson, options?.refDate)
    if (matchesToday) return true
  }

  // 4. Student or Guardian
  if (options?.studentId) {
    const asker = await getAskerAccess(access.userId, lesson.id, options.studentId)
    if (asker) return true
  }

  return false
}

/**
 * Can caller play the lesson video / generate signed video URL?
 * Same authorization as canViewLesson, with the requirement that video_path is present.
 */
export async function canPlayLesson(
  lesson: {
    id: string
    school_id: string
    class_id: string
    subject_id: string
    status: string
    recorded_by?: string | null
    video_path?: string | null
  },
  access: LmsAccessContext,
  options?: { studentId?: string; refDate?: Date }
): Promise<boolean> {
  if (!lesson.video_path) return false
  return canViewLesson(lesson, access, options)
}

/**
 * Can caller manage activities (create, edit, publish quizzes/assignments, mark submissions)?
 * Rule: Managers (lms.manage or lms.upload) AND the lesson's recorder (recorded_by = me) ONLY.
 * Facilitators have NO access to activities management.
 */
export function canManageActivities(
  lesson: { school_id: string; recorded_by?: string | null },
  access: LmsAccessContext
): boolean {
  if (lesson.school_id !== access.schoolId) return false
  if (access.isManager) return true
  return lesson.recorded_by === access.userId
}

/**
 * Can caller answer, reply to, close or delete a question thread on this lesson?
 * Rule:
 * - Admin/Manager sees and answers all Q&A.
 * - Recorder answers questions on their own lessons.
 * - Facilitator reads and answers questions only on lessons scheduled for them TODAY.
 * - Asker (student/guardian) can reply to their own question thread.
 */
export async function canAnswerThread(
  lesson: {
    id: string
    school_id: string
    class_id: string
    subject_id: string
    status: string
    recorded_by?: string | null
  },
  access: LmsAccessContext,
  options?: { threadAuthorId?: string; threadAuthorKind?: string; refDate?: Date }
): Promise<boolean> {
  if (lesson.school_id !== access.schoolId) return false

  // Asker can reply to/close their own thread
  if (options?.threadAuthorId && options.threadAuthorId === access.userId && options.threadAuthorKind !== 'staff') {
    return true
  }

  // Manager can answer any thread in the school
  if (access.isManager) return true

  // Recorder can answer threads on their own recorded lessons
  if (lesson.recorded_by === access.userId) return true

  // Facilitator can answer threads ONLY on lessons scheduled for them TODAY
  if (access.isFacilitator && lesson.status === 'published') {
    return facilitatorHasTodayEntryForLesson(access, lesson, options?.refDate)
  }

  return false
}

/**
 * Returns the list of lesson IDs for which the caller is authorized to view/answer Q&A.
 * - Manager: all lesson IDs in school
 * - Recorder: all lesson IDs where recorded_by = me
 * - Facilitator: only lesson IDs scheduled for them TODAY
 */
export async function getAnswerableLessonIds(
  access: LmsAccessContext,
  refDate?: Date
): Promise<string[]> {
  const admin = createAdminClient()

  if (access.isManager) {
    const { data: all } = await (admin as any)
      .from('lms_lessons')
      .select('id')
      .eq('school_id', access.schoolId)
    return (all ?? []).map((r: any) => r.id)
  }

  const ids = new Set<string>()

  // Recorder's lessons
  if (access.recordedLessonCount > 0) {
    const { data: recorded } = await (admin as any)
      .from('lms_lessons')
      .select('id')
      .eq('school_id', access.schoolId)
      .eq('recorded_by', access.userId)
    for (const r of recorded ?? []) {
      ids.add(r.id)
    }
  }

  // Facilitator's today-scheduled lessons
  if (access.isFacilitator) {
    const currentSession = await getCurrentAcademicSession(admin, access.schoolId)
    if (currentSession) {
      const { dayOfWeek } = todayInSchoolTz(access.schoolTimezone, refDate)
      const { data: todayEntries } = await (admin as any)
        .from('timetable_entries')
        .select('class_id, subject_id')
        .eq('school_id', access.schoolId)
        .eq('session_id', currentSession.id)
        .eq('teacher_id', access.userId)
        .eq('delivery_mode', 'lms')
        .eq('day_of_week', dayOfWeek)

      if (todayEntries && todayEntries.length > 0) {
        const pairs = todayEntries.map((e: any) => `${e.class_id}:${e.subject_id}`)
        const { data: publishedLessons } = await (admin as any)
          .from('lms_lessons')
          .select('id, class_id, subject_id')
          .eq('school_id', access.schoolId)
          .eq('status', 'published')

        for (const l of publishedLessons ?? []) {
          if (pairs.includes(`${l.class_id}:${l.subject_id}`)) {
            ids.add(l.id)
          }
        }
      }
    }
  }

  return Array.from(ids)
}
