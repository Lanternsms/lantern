/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { removeStorageDirectory } from './storage-utils'
import { extractNotesText } from '@/lib/lms/notes-extract'
import { emit } from '@/lib/notifications/service'
import {
  getLmsAccess,
  canPlayLesson,
  todayInSchoolTz,
  getCurrentAcademicSession,
  facilitatorHasTodayEntryForLesson,
} from '@/lib/lms/access'

// ─── createLesson ─────────────────────────────────────────────────────────────

export async function createLesson(formData: FormData) {
  const access = await getLmsAccess()
  if (!access.isManager) redirect('/dashboard?error=' + encodeURIComponent('Not found'))
  const { user, schoolId, supabase } = access

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
  const aiTutorEnabledRaw = formData.get('ai_tutor_enabled')
  const aiTutorEnabled = aiTutorEnabledRaw === null ? true : (aiTutorEnabledRaw === 'on' || aiTutorEnabledRaw === 'true')

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
      ai_tutor_enabled: aiTutorEnabled,
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
  const access = await getLmsAccess()
  if (!access.isManager) redirect('/dashboard?error=' + encodeURIComponent('Not found'))
  const { supabase } = access

  const title = (formData.get('title') as string)?.trim()
  if (!title) redirect(`/dashboard/lms/${lessonId}?error=` + encodeURIComponent('Title is required.'))

  const termIdRaw = formData.get('term_id') as string
  const weekNoRaw = formData.get('week_no') as string
  const recordedByRaw = formData.get('recorded_by') as string
  const aiTutorEnabledRaw = formData.get('ai_tutor_enabled')
  const aiTutorEnabled = aiTutorEnabledRaw === 'on' || aiTutorEnabledRaw === 'true'

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
      ai_tutor_enabled: aiTutorEnabled,
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
  const access = await getLmsAccess()
  if (!access.isManager) {
    return { error: 'Not found' }
  }
  const { user, schoolId, supabase } = access

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

// ─── Lesson Notes Actions (PDF) ───────────────────────────────────────────────

function sanitiseFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ').trim()
}

export async function createNotesUploadUrl(lessonId: string) {
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { schoolId } = access

  const admin = createAdminClient()
  const { data: lesson, error: fetchErr } = await (admin as any)
    .from('lms_lessons')
    .select('id')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !lesson) return { error: 'Not found' }

  const path = `${schoolId}/${lessonId}/notes-${Date.now()}.pdf`
  const { data, error } = await admin.storage
    .from('lms-notes')
    .createSignedUploadUrl(path, { upsert: true })

  if (error || !data) {
    return { error: error?.message ?? 'Failed to create upload URL.' }
  }

  return {
    ok: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path,
  }
}

export async function attachLessonNotes(
  lessonId: string,
  path: string,
  originalName: string,
  downloadable: boolean = true
) {
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { schoolId, supabase } = access

  // 1. Verify path belongs to this school and lesson
  const expectedPrefix = `${schoolId}/${lessonId}/`
  if (!path || !path.startsWith(expectedPrefix)) {
    return { error: 'Invalid notes path.' }
  }

  const admin = createAdminClient()

  // 2. Verify object exists and is <= 25 MB
  const { data: blob, error: dlErr } = await admin.storage
    .from('lms-notes')
    .download(path)

  if (dlErr || !blob) {
    return { error: 'Uploaded notes file could not be verified in storage.' }
  }

  const MAX_NOTES_BYTES = 25 * 1024 * 1024
  if (blob.size > MAX_NOTES_BYTES) {
    await admin.storage.from('lms-notes').remove([path])
    return { error: 'File exceeds maximum allowed size of 25 MB.' }
  }

  // 3. Verify magic bytes (%PDF-)
  const arrayBuffer = await blob.arrayBuffer()
  const header = Buffer.from(arrayBuffer.slice(0, 5)).toString('utf-8')
  if (header !== '%PDF-') {
    await admin.storage.from('lms-notes').remove([path])
    return { error: 'Invalid file format. File must be a valid PDF.' }
  }

  // 4. Fetch existing lesson record to inspect previous notes_path and status
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, notes_path, status')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !existing) {
    await admin.storage.from('lms-notes').remove([path])
    return { error: 'Not found' }
  }

  const oldPath: string | null = existing.notes_path
  const isNewlyAdded = !oldPath

  // 5. Update lms_lessons
  const { data: updated, error: updateErr } = await (supabase as any)
    .from('lms_lessons')
    .update({
      notes_path: path,
      notes_name: originalName || 'notes.pdf',
      notes_size_bytes: blob.size,
      notes_uploaded_at: new Date().toISOString(),
      notes_downloadable: Boolean(downloadable),
    })
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .select('id')

  if (updateErr) return { error: updateErr.message }
  if (!updated || updated.length === 0) return { error: 'Not found' }

  // 6. Delete old object if replacing
  if (oldPath && oldPath !== path) {
    if (oldPath.startsWith(expectedPrefix)) {
      const { data: removeData, error: removeErr } = await admin.storage
        .from('lms-notes')
        .remove([oldPath])

      const oldFilename = oldPath.split('/').pop() ?? ''
      const isRemoved =
        !removeErr &&
        Array.isArray(removeData) &&
        removeData.length > 0 &&
        removeData.some((item) => item.name === oldFilename || item.name === oldPath)

      if (!isRemoved) {
        await logSchoolAction('lms_orphan_storage_cleanup_failed', {
          metadata: {
            lessonId,
            bucket: 'lms-notes',
            oldPath,
            error: removeErr?.message ?? 'Old notes object was not listed in storage remove result',
            removeData,
          },
        })
      }
    }
  }

  // 7. Set lms_lesson_notes_text to 'pending'
  await (admin as any)
    .from('lms_lesson_notes_text')
    .upsert({
      lesson_id: lessonId,
      school_id: schoolId,
      status: 'pending',
      content: null,
      error: null,
      extracted_at: new Date().toISOString(),
    })

  // 8. Trigger background extraction with after()
  after(async () => {
    try {
      await extractNotesText(lessonId, schoolId, path)
    } catch (err) {
      console.error('[attachLessonNotes] Extraction failed:', err)
    }
  })

  // 9. Audit log
  await logSchoolAction('lms_notes_attached', {
    metadata: {
      lessonId,
      path,
      originalName,
      sizeBytes: blob.size,
    },
  })

  // 10. Notify if lesson is already published and notes were newly added (not replaced)
  if (existing.status === 'published' && isNewlyAdded) {
    after(async () => {
      try {
        await emit('lms_notes_attached', { schoolId, lessonId })
      } catch (err) {
        console.error('[attachLessonNotes] Notification failed:', err)
      }
    })
  }

  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true }
}

export async function removeLessonNotes(lessonId: string) {
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { schoolId, supabase } = access

  const admin = createAdminClient()

  // Fetch current notes_path
  const { data: existing, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('notes_path')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !existing) return { error: 'Not found' }

  const oldPath: string | null = existing.notes_path
  if (oldPath) {
    const { data: removeData, error: removeErr } = await admin.storage
      .from('lms-notes')
      .remove([oldPath])

    const oldFilename = oldPath.split('/').pop() ?? ''
    const isRemoved =
      !removeErr &&
      Array.isArray(removeData) &&
      removeData.length > 0 &&
      removeData.some((item) => item.name === oldFilename || item.name === oldPath)

    if (!isRemoved) {
      await logSchoolAction('lms_orphan_storage_cleanup_failed', {
        metadata: {
          lessonId,
          bucket: 'lms-notes',
          oldPath,
          error: removeErr?.message ?? 'Notes object was not listed in storage remove result',
          removeData,
        },
      })
    }
  }

  // Update DB columns
  const { data: updated, error: updateErr } = await (supabase as any)
    .from('lms_lessons')
    .update({
      notes_path: null,
      notes_name: null,
      notes_size_bytes: null,
      notes_uploaded_at: null,
      notes_downloadable: false,
    })
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .select('id')

  if (updateErr) return { error: updateErr.message }
  if (!updated || updated.length === 0) return { error: 'Not found' }

  // Clean up extracted text
  await (admin as any)
    .from('lms_lesson_notes_text')
    .delete()
    .eq('lesson_id', lessonId)
    .eq('school_id', schoolId)

  await logSchoolAction('lms_notes_removed', { metadata: { lessonId } })
  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true }
}

export async function setNotesDownloadable(lessonId: string, downloadable: boolean) {
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { schoolId, supabase } = access

  const { data, error } = await (supabase as any)
    .from('lms_lessons')
    .update({ notes_downloadable: Boolean(downloadable) })
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Not found' }

  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true }
}

export async function reextractNotes(lessonId: string) {
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { schoolId, supabase } = access

  const { data: lesson, error: fetchErr } = await (supabase as any)
    .from('lms_lessons')
    .select('id, notes_path')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !lesson || !lesson.notes_path) {
    return { error: 'No notes attached to this lesson.' }
  }

  const admin = createAdminClient()
  await (admin as any)
    .from('lms_lesson_notes_text')
    .upsert({
      lesson_id: lessonId,
      school_id: schoolId,
      status: 'pending',
      error: null,
      extracted_at: new Date().toISOString(),
    })

  const result = await extractNotesText(lessonId, schoolId, lesson.notes_path)
  revalidatePath(`/dashboard/lms/${lessonId}`)
  return { success: true, status: result.status }
}

export async function getNotesDownloadUrl(lessonId: string, studentId?: string) {
  const access = await getLmsAccess()
  const { schoolId, user } = access

  const admin = createAdminClient()

  const { data: lesson, error: fetchErr } = await (admin as any)
    .from('lms_lessons')
    .select(`
      id,
      school_id,
      title,
      status,
      notes_path,
      notes_name,
      notes_downloadable,
      recorded_by,
      class_id,
      subjects:subject_id ( name )
    `)
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (fetchErr || !lesson || !lesson.notes_path) {
    return { error: 'Not found' }
  }

  // Authorization check
  let authorized = false

  if (access.isManager) {
    authorized = true
  } else if (lesson.recorded_by === user.id) {
    authorized = true
  } else if (access.isFacilitator) {
    const hasToday = await facilitatorHasTodayEntryForLesson(access, lesson)
    if (hasToday) authorized = true
  } else {
    // Student or guardian: requires published lesson + notes_downloadable true
    if (lesson.status === 'published' && lesson.notes_downloadable) {
      const currentSession = await getCurrentAcademicSession(admin, schoolId)
      if (currentSession && lesson.class_id) {
        if (studentId) {
          // Check guardian relationship
          const { data: rels } = await admin
            .from('student_guardians')
            .select('guardian_id, guardians!inner(profile_id)')
            .eq('student_id', studentId)

          const isGuardian = (rels ?? []).some((r: any) => r.guardians?.profile_id === user.id)
          if (isGuardian) {
            // Verify enrollment in lesson's class for current session
            const { data: enrol } = await (admin as any)
              .from('enrolments')
              .select('id')
              .eq('school_id', schoolId)
              .eq('session_id', currentSession.id)
              .eq('class_id', lesson.class_id)
              .eq('student_id', studentId)
              .maybeSingle()

            if (enrol) authorized = true
          }
        } else {
          // Check student self-enrollment
          const { data: stRow } = await (admin as any)
            .from('students')
            .select('id')
            .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
            .maybeSingle()

          if (stRow) {
            const { data: enrol } = await (admin as any)
              .from('enrolments')
              .select('id')
              .eq('school_id', schoolId)
              .eq('session_id', currentSession.id)
              .eq('class_id', lesson.class_id)
              .eq('student_id', stRow.id)
              .maybeSingle()

            if (enrol) authorized = true
          }
        }
      }
    }
  }

  if (!authorized) {
    return { error: 'Not found' }
  }

  const subjectName = (lesson.subjects as any)?.name ?? 'Subject'
  const downloadName = sanitiseFilename(`${subjectName} - ${lesson.title}.pdf`)

  const { data: signed, error: signErr } = await admin.storage
    .from('lms-notes')
    .createSignedUrl(lesson.notes_path, 300, {
      download: downloadName,
    })

  if (signErr || !signed) {
    return { error: 'Not found' }
  }

  return { ok: true, url: signed.signedUrl }
}

// ─── setLessonStatus ──────────────────────────────────────────────────────────

export async function setLessonStatus(lessonId: string, status: 'draft' | 'published'): Promise<void> {
  const access = await getLmsAccess()
  if (!access.isManager) redirect('/dashboard?error=' + encodeURIComponent('Not found'))
  const { supabase } = access

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
  const access = await getLmsAccess()
  if (!access.isManager) return { error: 'Not found' }
  const { supabase, schoolId } = access

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

  // Clean up lesson notes in lms-notes under `${schoolId}/${lessonId}`
  const notesRes = await removeStorageDirectory(admin, 'lms-notes', `${schoolId}/${lessonId}`)
  if (notesRes.error) {
    await logSchoolAction('lms_orphan_storage_cleanup_failed', {
      metadata: {
        lessonId,
        bucket: 'lms-notes',
        path: `${schoolId}/${lessonId}`,
        error: notesRes.error,
      },
    })
  }

  // Clean up notes text extraction row
  await (admin as any)
    .from('lms_lesson_notes_text')
    .delete()
    .eq('lesson_id', lessonId)
    .eq('school_id', schoolId)

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
  const access = await getLmsAccess()
  if (!access.isManager && !access.isFacilitator) return { error: 'Not found' }
  const { user, schoolId, supabase } = access

  const admin = createAdminClient()
  const currentSession = await getCurrentAcademicSession(admin, schoolId)
  if (!currentSession) {
    return { error: 'Not found' }
  }

  // Load entry
  const { data: entry, error: entryErr } = await (admin as any)
    .from('timetable_entries')
    .select('id, school_id, session_id, class_id, arm_id, subject_id, teacher_id, delivery_mode, day_of_week')
    .eq('id', timetableEntryId)
    .eq('school_id', schoolId)
    .single()

  if (entryErr || !entry || entry.delivery_mode !== 'lms' || entry.session_id !== currentSession.id) {
    return { error: 'Not found' }
  }

  const { dateStr, dayOfWeek } = todayInSchoolTz(access.schoolTimezone)

  if (!access.isManager) {
    if (entry.teacher_id !== user.id || entry.day_of_week !== dayOfWeek) {
      return { error: 'Not found' }
    }
  }

  // Verify the lesson is published with the SAME class_id and subject_id as the entry
  const { data: lesson, error: lessonErr } = await (admin as any)
    .from('lms_lessons')
    .select('id, class_id, subject_id, status, video_path, title')
    .eq('id', lessonId)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson || lesson.status !== 'published' || !lesson.video_path) {
    return { error: 'Not found' }
  }
  if (lesson.class_id !== entry.class_id || lesson.subject_id !== entry.subject_id) {
    return { error: 'Not found' }
  }

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
  const access = await getLmsAccess()
  if (!access.isManager && !access.isFacilitator) return { error: 'Not found' }
  const { user, schoolId } = access
  const admin = createAdminClient()

  let deleteQuery = (admin as any)
    .from('lms_lesson_deliveries')
    .delete()
    .eq('id', deliveryId)
    .eq('school_id', schoolId)

  if (!access.isManager) {
    const { dateStr } = todayInSchoolTz(access.schoolTimezone)
    deleteQuery = deleteQuery.eq('delivered_by', user.id).eq('delivered_on', dateStr)
  }

  const { data, error } = await deleteQuery.select('id')
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Not found' }
  }

  await logSchoolAction('lms_lesson_delivery_undone', { metadata: { deliveryId } })
  revalidatePath('/dashboard/lms/today')
  return { success: true }
}

// ─── getLessonVideoUrl ────────────────────────────────────────────────────────

export async function getLessonVideoUrl(lessonId: string, studentId?: string) {
  const GENERIC_ERROR = 'Not found'
  const access = await getLmsAccess()
  const admin = createAdminClient()

  // 1. Fetch lesson
  const { data: lesson, error: fetchErr } = await (admin as any)
    .from('lms_lessons')
    .select('id, school_id, class_id, subject_id, status, video_path, video_codec, recorded_by')
    .eq('id', lessonId)
    .eq('school_id', access.schoolId)
    .maybeSingle()

  if (fetchErr || !lesson || !lesson.video_path) {
    return { error: GENERIC_ERROR }
  }

  // 2. Re-check caller authorization via canPlayLesson
  const allowed = await canPlayLesson(lesson, access, { studentId })
  if (!allowed) {
    return { error: GENERIC_ERROR }
  }

  // 3. Generate signed URL (2 hours) using admin client after verification
  const { data: signed, error: signErr } = await admin.storage
    .from('lms-lessons')
    .createSignedUrl(lesson.video_path, 7200)

  if (signErr || !signed) return { error: GENERIC_ERROR }

  return {
    url: signed.signedUrl,
    videoCodec: lesson.video_codec ?? null,
    isStaff: access.isManager || lesson.recorded_by === access.userId,
  }
}
