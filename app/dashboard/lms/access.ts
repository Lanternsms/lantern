// app/dashboard/lms/access.ts
// Re-export from single source of truth in @/lib/lms/access
export * from '@/lib/lms/access'

// ─── Legacy shim helpers ──────────────────────────────────────────────────────
// These accept the OLD userId-based signatures used by activities/actions.ts and
// questions/actions.ts, and bridge them to the new LmsAccessContext-based helpers
// in @/lib/lms/access.  Callers should migrate to getLmsAccess() directly, but
// these shims keep the existing code compiling unchanged.

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getLmsAccess, canManageActivities as _canManageActivities } from '@/lib/lms/access'

/**
 * @deprecated Use canManageActivities(lesson, access) from @/lib/lms/access instead.
 * Keeps backward-compatibility for callers that pass (userId, lessonId).
 */
export async function canManageActivitiesLegacy(
  userId: string,
  lessonId: string
): Promise<boolean> {
  const admin = createAdminClient() as any
  const supabase = await createClient()
  const access = await getLmsAccess(supabase)
  if (access.userId !== userId) return false

  const { data: lesson } = await admin
    .from('lms_lessons')
    .select('school_id, recorded_by')
    .eq('id', lessonId)
    .eq('school_id', access.schoolId)
    .maybeSingle()

  if (!lesson) return false
  return _canManageActivities(lesson, access)
}

/**
 * @deprecated Use canManageActivities(lesson, access) from @/lib/lms/access instead.
 * "View activity results" = same as canManageActivities in the new model:
 * only managers and the lesson's recorder may view submissions.
 * Facilitators have NO access to activity results.
 */
export async function canViewActivityResults(
  userId: string,
  lessonId: string
): Promise<boolean> {
  return canManageActivitiesLegacy(userId, lessonId)
}

/**
 * @deprecated Use canAnswerThread(lesson, access) from @/lib/lms/access instead.
 * Bridges old (userId, lesson) signature to new context-based helper.
 */
export async function canAnswerLesson(
  userId: string,
  lesson: { id?: string; class_id: string; subject_id: string; recorded_by?: string | null }
): Promise<boolean> {
  const supabase = await createClient()
  const access = await getLmsAccess(supabase)
  if (access.userId !== userId) return false

  const admin = createAdminClient() as any
  // Need full lesson record for canAnswerThread
  let fullLesson = lesson as any
  if (lesson.id) {
    const { data } = await admin
      .from('lms_lessons')
      .select('id, school_id, class_id, subject_id, status, recorded_by')
      .eq('id', lesson.id)
      .maybeSingle()
    if (data) fullLesson = data
  }

  if (!fullLesson.school_id) return false

  const { canAnswerThread } = await import('@/lib/lms/access')
  return canAnswerThread(fullLesson, access)
}

/**
 * @deprecated Use getAnswerableLessonIds(access) from @/lib/lms/access instead.
 * Bridges the old userId-only signature.
 */
export async function getAnswerableLessonIdsForUser(
  userId: string
): Promise<string[]> {
  const supabase = await createClient()
  const access = await getLmsAccess(supabase)
  if (access.userId !== userId) return []

  const { getAnswerableLessonIds } = await import('@/lib/lms/access')
  return getAnswerableLessonIds(access)
}
