/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { getTodayInLagos } from './lagos-time'
import { getAskerAccess } from '@/app/dashboard/lms/access'
import { removeStorageDirectory } from './storage-utils'

// ─── Shared context helper ────────────────────────────────────────────────────

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

async function requirePermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  perm: string
) {
  const { data: ok } = await supabase.rpc('has_permission', { perm_code: perm })
  if (!ok) redirect('/dashboard?error=' + encodeURIComponent('Permission denied.'))
}

// ─── createLesson ─────────────────────────────────────────────────────────────

export async function createLesson(formData: FormData) {
  const { supabase, user, schoolId } = await getContext()
  await requirePermission(supabase, 'lms.manage')

  const title = (formData.get('title') as string)?.trim()
  if (!title) redirect('/dashboard/lms/new?error=' + encodeURIComponent('Title is required.'))

  const classId = formData.get('class_id') as string
  const subjectId = formData.get('subject_id') as string
  if (!classId || !subjectId) {
    redirect('/dashboard/lms/new?error=' + encodeURIComponent('Class and subject are required.'))
  }

  const termIdRaw = formData.get('term_id') as string
  const weekNoRaw = formData.get('week_no') as string
  const recordedByRaw = formData.get('recorded_by') as string

  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .insert({
      school_id: schoolId,
      class_id: classId,
      subject_id: subjectId,
      term_id: termIdRaw || null,
      week_no: weekNoRaw ? parseInt(weekNoRaw, 10) : null,
      title,
      topic: (formData.get('topic') as string)?.trim() || null,
      recorded_by: recordedByRaw || user.id,
      uploaded_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error || !data) {
    redirect('/dashboard/lms/new?error=' + encodeURIComponent(error?.message ?? 'Insert failed.'))
  }

  await logSchoolAction('lms_lesson_created', { metadata: { lessonId: data.id, title } })
  revalidatePath('/dashboard/lms')
  redirect(`/dashboard/lms/${data.id}`)
}

// ─── updateLesson ─────────────────────────────────────────────────────────────

export async function updateLesson(lessonId: string, formData: FormData): Promise<void> {
  const { supabase } = await getContext()
  await requirePermission(supabase, 'lms.manage')

  const title = (formData.get('title') as string)?.trim()
  if (!title) redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent('Title is required.'))

  const termIdRaw = formData.get('term_id') as string
  const weekNoRaw = formData.get('week_no') as string
  const recordedByRaw = formData.get('recorded_by') as string

  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .update({
      class_id: formData.get('class_id') as string,
      subject_id: formData.get('subject_id') as string,
      term_id: termIdRaw || null,
      week_no: weekNoRaw ? parseInt(weekNoRaw, 10) : null,
      title,
      topic: (formData.get('topic') as string)?.trim() || null,
      recorded_by: recordedByRaw || null,
    })
    .eq('id', lessonId)
    .select('id')

  if (error) redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent(error.message))
  if (!data || data.length === 0) redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent('Lesson not found or access denied.'))

  await logSchoolAction('lms_lesson_updated', { metadata: { lessonId, title } })
  revalidatePath(`/dashboard/lms/${lessonId}`)
  revalidatePath('/dashboard/lms')
  redirect(`/dashboard/lms/${lessonId}?success=` + encodeURIComponent('Lesson updated successfully.'))
}

// ─── attachLessonVideo ────────────────────────────────────────────────────────

const ALLOWED_VIDEO_CODECS = new Set(['h264', 'hevc', 'av1', 'vp8', 'vp9', 'prores', 'other'])

export async function attachLessonVideo(
  lessonId: string,
  videoPath: string,
  durationSeconds: number | null,
  videoSizeBytes?: number | null,
  videoCodec?: string | null,
  videoWidth?: number | null,
  videoHeight?: number | null
) {
  const { supabase, user, schoolId } = await getContext()
  await requirePermission(supabase, 'lms.upload')

  // Validate path prefix — must belong to this school and lesson
  const expectedPrefix = `${schoolId}/${lessonId}.`
  if (!videoPath.startsWith(expectedPrefix)) {
    return { error: 'Invalid video path.' }
  }

  // Validate metadata if provided
  if (videoSizeBytes !== undefined && videoSizeBytes !== null) {
    if (typeof videoSizeBytes !== 'number' || videoSizeBytes < 1 || videoSizeBytes > 500 * 1024 * 1024) {
      return { error: 'Video file size must be between 1 byte and 500 MB.' }
    }
  }

  if (videoCodec !== undefined && videoCodec !== null) {
    if (typeof videoCodec !== 'string' || !ALLOWED_VIDEO_CODECS.has(videoCodec.toLowerCase())) {
      return { error: 'Invalid or unsupported video codec.' }
    }
  }

  if (videoWidth !== undefined && videoWidth !== null) {
    if (typeof videoWidth !== 'number' || videoWidth <= 0) {
      return { error: 'Video width must be a positive number.' }
    }
  }

  if (videoHeight !== undefined && videoHeight !== null) {
    if (typeof videoHeight !== 'number' || videoHeight <= 0) {
      return { error: 'Video height must be a positive number.' }
    }
  }

  // Verify the object actually exists in the bucket before saving video_path
  const admin = createAdminClient()
  const filename = videoPath.split('/').pop() ?? ''
  const { data: listedFiles, error: listErr } = await admin.storage
    .from('lms-lessons')
    .list(schoolId, { search: lessonId })

  if (listErr || !listedFiles || !listedFiles.some((f) => f.name === filename)) {
    return { error: 'Uploaded video file could not be verified in storage.' }
  }

  // 1. Read the lesson's existing video_path BEFORE updating
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('video_path, school_id')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (fetchErr || !existing) return { error: 'Lesson not found or access denied.' }

  const oldPath: string | null = existing.video_path

  // Update DB record
  const updatePayload: Record<string, unknown> = {
    video_path: videoPath,
    duration_seconds: durationSeconds,
    uploaded_by: user.id,
  }
  if (videoSizeBytes !== undefined) updatePayload.video_size_bytes = videoSizeBytes
  if (videoCodec !== undefined) updatePayload.video_codec = videoCodec ? videoCodec.toLowerCase() : null
  if (videoWidth !== undefined) updatePayload.video_width = videoWidth
  if (videoHeight !== undefined) updatePayload.video_height = videoHeight

  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .update(updatePayload)
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Lesson not found or access denied.' }

  // After the DB update succeeds: if an old path exists and differs from the new path, remove the old object
  if (oldPath && oldPath !== videoPath) {
    // Only ever remove paths that start with `${school_id}/${lessonId}.`
    if (oldPath.startsWith(expectedPrefix)) {
      const admin = createAdminClient()
      const { data: removeData, error: removeErr } = await admin.storage
        .from('lms-lessons')
        .remove([oldPath])

      const oldFilename = oldPath.split('/').pop() ?? ''
      const isRemoved =
        !removeErr &&
        Array.isArray(removeData) &&
        removeData.length > 0 &&
        removeData.some((item) => item.name === oldFilename || item.name === oldPath)

      // If not confirmed listed in the remove result, log it but don't fail the upload
      if (!isRemoved) {
        await logSchoolAction('lms_orphan_storage_cleanup_failed', {
          metadata: {
            lessonId,
            oldPath,
            error: removeErr?.message ?? 'Old video object was not listed in storage remove result',
            removeData,
          },
        })
      }
    }
  }

  await logSchoolAction('lms_video_attached', { metadata: { lessonId, videoPath } })
  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true }
}

// ─── setLessonStatus ──────────────────────────────────────────────────────────

export async function setLessonStatus(lessonId: string, status: 'draft' | 'published'): Promise<void> {
  const { supabase } = await getContext()
  await requirePermission(supabase, 'lms.manage')

  if (status === 'published') {
    const { data: lesson, error: fetchErr } = await (supabase as any)
      .from('lms_lessons')
      .select('video_path')
      .eq('id', lessonId)
      .single()

    if (fetchErr || !lesson) {
      redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent('Lesson not found.'))
    }
    if (!lesson.video_path) {
      redirect(
        `/dashboard/lms/${lessonId}?error=` +
          encodeURIComponent('A video must be uploaded before the lesson can be published.')
      )
    }
  }

  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .update({ status })
    .eq('id', lessonId)
    .select('id')

  if (error) redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent(error.message))
  if (!data || data.length === 0) {
    redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent('Lesson not found or access denied.'))
  }

  await logSchoolAction('lms_lesson_status_changed', { metadata: { lessonId, status } })
  revalidatePath(`/dashboard/lms/${lessonId}`)
  revalidatePath('/dashboard/lms')
  redirect(
    `/dashboard/lms/${lessonId}?success=` +
      encodeURIComponent(status === 'published' ? 'Lesson published.' : 'Lesson unpublished.')
  )
}

// ─── deleteLesson ─────────────────────────────────────────────────────────────

export async function deleteLesson(lessonId: string) {
  const { supabase, schoolId } = await getContext()
  await requirePermission(supabase, 'lms.manage')

  // Verify school ownership and lesson existence
  const { data: lesson, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, school_id')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (fetchErr || !lesson) return { error: 'Lesson not found or access denied.' }

  // List the bucket folder with the admin client and remove EVERY object whose name starts with `${lessonId}.`
  const admin = createAdminClient()
  const { data: files, error: listErr } = await admin.storage
    .from('lms-lessons')
    .list(schoolId, { search: lessonId })

  if (listErr) {
    return { error: `Failed to inspect storage: ${listErr.message}` }
  }

  const prefix = `${lessonId}.`
  const toRemove = (files ?? [])
    .filter((file) => file.name && file.name.startsWith(prefix))
    .map((file) => `${schoolId}/${file.name}`)

  if (toRemove.length > 0) {
    const { error: removeErr } = await admin.storage
      .from('lms-lessons')
      .remove(toRemove)

    if (removeErr) {
      return { error: `Failed to remove lesson video files: ${removeErr.message}` }
    }
  }

  // Collect activities for this lesson and clean up their files in lms-submissions
  const { data: activities, error: actErr } = await (admin as any)
    .from('lms_activities')
    .select('id')
    .eq('lesson_id', lessonId)
    .eq('school_id', schoolId)

  if (actErr) {
    return { error: `Failed to inspect activities: ${actErr.message}` }
  }

  for (const act of (activities ?? [])) {
    const res = await removeStorageDirectory(admin, 'lms-submissions', `${schoolId}/${act.id}`)
    if (res.error) {
      return { error: `Failed to remove activity files from storage: ${res.error}` }
    }
  }

  // Delete the DB row
  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .delete()
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Lesson not found or access denied.' }

  await logSchoolAction('lms_lesson_deleted', { metadata: { lessonId } })
  revalidatePath('/dashboard/lms')
  return { success: true }
}

// ─── markLessonDelivered & undoLessonDelivery ─────────────────────────────────

export async function markLessonDelivered({
  lessonId,
  timetableEntryId,
}: {
  lessonId: string
  timetableEntryId: string
}) {
  const { supabase, user, schoolId } = await getContext()
  const [{ data: canFacilitate }, { data: canManage }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
  ])
  if (!canFacilitate && !canManage) return { error: 'Permission denied.' }

  // Load entry
  const { data: entry, error: entryErr } = await (supabase as any)
    .from('timetable_entries')
    .select('id, school_id, session_id, class_id, arm_id, subject_id, teacher_id, delivery_mode')
    .eq('id', timetableEntryId)
    .eq('school_id', schoolId)
    .single()

  if (entryErr || !entry) return { error: 'Timetable entry not found.' }

  // Verify in user's school and current session
  const { data: currentSession } = await supabase
    .from('academic_sessions')
    .select('id')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .single()

  if (!currentSession || entry.session_id !== currentSession.id) {
    return { error: 'Entry is not in the current academic session.' }
  }

  if (entry.delivery_mode !== 'lms') {
    return { error: 'This entry is not scheduled for recorded lesson (LMS) delivery.' }
  }

  if (!canManage && entry.teacher_id !== user.id) {
    return { error: 'You are not assigned as the facilitator for this period.' }
  }

  // Verify the lesson is published with the SAME class_id and subject_id as the entry
  const { data: lesson, error: lessonErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, class_id, subject_id, status, video_path, title')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson) return { error: 'Lesson not found.' }
  if (lesson.status !== 'published' || !lesson.video_path) {
    return { error: 'Only published lessons with video can be delivered.' }
  }
  if (lesson.class_id !== entry.class_id || lesson.subject_id !== entry.subject_id) {
    return { error: 'Lesson class and subject must match the timetable period.' }
  }

  const { dateStr } = getTodayInLagos()

  const { data: inserted, error: insertErr } = await (supabase as any)
    .from('lms_lesson_deliveries')
    .insert({
      school_id: schoolId,
      lesson_id: lessonId,
      class_id: entry.class_id,
      arm_id: entry.arm_id ?? null,
      timetable_entry_id: entry.id,
      delivered_by: user.id,
      delivered_on: dateStr,
    })
    .select('id')
    .single()

  // Treat unique-violation as success (idempotent)
  if (insertErr) {
    if (
      insertErr.code === '23505' ||
      insertErr.message?.includes('duplicate key') ||
      insertErr.message?.includes('unique')
    ) {
      revalidatePath('/dashboard/lms/today')
      return { success: true }
    }
    return { error: insertErr.message }
  }

  await logSchoolAction('lms_lesson_delivered', {
    metadata: {
      deliveryId: inserted?.id,
      lessonId,
      timetableEntryId,
      classId: entry.class_id,
      armId: entry.arm_id,
      deliveredOn: dateStr,
    },
  })

  revalidatePath('/dashboard/lms/today')
  return { success: true, id: inserted?.id }
}

export async function undoLessonDelivery(deliveryId: string) {
  const { supabase, user, schoolId } = await getContext()
  const [{ data: canFacilitate }, { data: canManage }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
  ])
  if (!canFacilitate && !canManage) return { error: 'Permission denied.' }

  let deleteQuery = (supabase as any)
    .from('lms_lesson_deliveries')
    .delete()
    .eq('id', deliveryId)
    .eq('school_id', schoolId)

  if (!canManage) {
    deleteQuery = deleteQuery.eq('delivered_by', user.id)
  }

  const { data, error } = await deleteQuery.select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Delivery record not found or access denied.' }
  }

  await logSchoolAction('lms_lesson_delivery_undone', { metadata: { deliveryId } })
  revalidatePath('/dashboard/lms/today')
  return { success: true }
}

// ─── getLessonVideoUrl ────────────────────────────────────────────────────────

export async function getLessonVideoUrl(lessonId: string, studentId?: string) {
  const GENERIC_ERROR = 'Could not access lesson video.'
  const { supabase, user, schoolId } = await getContext()

  // 1. Fetch lesson
  const { data: lesson, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, video_path, video_codec')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (fetchErr || !lesson || !lesson.video_path) {
    return { error: GENERIC_ERROR }
  }

  // Caller permissions
  const [{ data: canManage }, { data: canUpload }, { data: canFacilitate }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
    supabase.rpc('has_permission', { perm_code: 'lms.upload' }),
    supabase.rpc('has_permission', { perm_code: 'lms.facilitate' }),
  ])

  const isStaff = !!(canManage || canUpload)
  const videoCodec: string | null = lesson.video_codec ?? null

  // Class a: lms.manage or lms.upload: any lesson in their school (signed URL via user client, 2 hours, as today)
  if (canManage || canUpload) {
    const { data: signed, error: signErr } = await supabase.storage
      .from('lms-lessons')
      .createSignedUrl(lesson.video_path, 7200)

    if (signErr || !signed) {
      const admin = createAdminClient()
      const { data: adminSigned, error: adminSignErr } = await admin.storage
        .from('lms-lessons')
        .createSignedUrl(lesson.video_path, 7200)
      if (adminSignErr || !adminSigned) return { error: GENERIC_ERROR }
      return { url: adminSigned.signedUrl, videoCodec, isStaff }
    }
    return { url: signed.signedUrl, videoCodec, isStaff }
  }

  // Class b: lms.facilitate only:
  // The lesson must be published AND user must have a delivery_mode='lms' timetable entry
  // (teacher_id = user, current session) with same class_id and subject_id as lesson.
  if (canFacilitate) {
    if (lesson.status !== 'published') return { error: GENERIC_ERROR }

    const { data: currentSession } = await supabase
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .single()

    if (!currentSession) return { error: GENERIC_ERROR }

    const { data: entry } = await (supabase as any)
      .from('timetable_entries')
      .select('id')
      .eq('school_id', schoolId)
      .eq('session_id', currentSession.id)
      .eq('teacher_id', user.id)
      .eq('delivery_mode', 'lms')
      .eq('class_id', lesson.class_id)
      .eq('subject_id', lesson.subject_id)
      .limit(1)
      .maybeSingle()

    if (!entry) return { error: GENERIC_ERROR }

    const { data: signed, error: signErr } = await supabase.storage
      .from('lms-lessons')
      .createSignedUrl(lesson.video_path, 7200)

    if (signErr || !signed) {
      const admin = createAdminClient()
      const { data: adminSigned, error: adminSignErr } = await admin.storage
        .from('lms-lessons')
        .createSignedUrl(lesson.video_path, 7200)
      if (adminSignErr || !adminSigned) return { error: GENERIC_ERROR }
      return { url: adminSigned.signedUrl, videoCodec, isStaff }
    }
    return { url: signed.signedUrl, videoCodec, isStaff }
  }

  // Class c: Everyone else (student/guardian):
  // Lesson must be published with video_path, and studentId is required.
  if (lesson.status !== 'published' || !studentId) {
    return { error: GENERIC_ERROR }
  }

  // Verify caller is that student's guardian or the student themselves using shared helper
  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) return { error: GENERIC_ERROR }

  // Sign with createAdminClient() (2 hours)
  const admin = createAdminClient()
  const { data: signed, error: signErr } = await admin.storage
    .from('lms-lessons')
    .createSignedUrl(lesson.video_path, 7200)

  if (signErr || !signed) return { error: GENERIC_ERROR }
  return { url: signed.signedUrl, videoCodec, isStaff }
}
