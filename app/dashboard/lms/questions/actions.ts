// app/dashboard/lms/questions/actions.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { getAskerAccess, canAnswerLesson, getAnswerableLessonIds } from '@/app/dashboard/lms/access'

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

/** Ask a new root question. */
export async function askQuestion({ lessonId, studentId, body }: { lessonId: string; studentId: string; body: string }) {
  const { supabase, user, schoolId } = await getContext()

  // Verify asker access
  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) return { error: 'Not authorized to ask question.' }

  const trimmed = body.trim()
  if (trimmed.length === 0 || trimmed.length > 2000) {
    return { error: 'Question must be 1‑2000 characters.' }
  }

  // Enforce max 10 open questions per student per lesson
  const { data: existingOpen } = await (supabase as any)
    .from('lms_lesson_messages')
    .select('id')
    .eq('school_id', schoolId)
    .eq('lesson_id', lessonId)
    .eq('student_id', studentId)
    .eq('status', 'open')
    .is('parent_id', null)

  if ((existingOpen ?? []).length >= 10) {
    return { error: 'Maximum of 10 open questions per lesson per student reached.' }
  }

  // Insert root message using admin client (RLS blocks direct inserts)
  const admin = createAdminClient() as any
  const { data: inserted, error } = await admin
    .from('lms_lesson_messages')
    .insert({
      school_id: schoolId,
      lesson_id: lessonId,
      parent_id: null,
      student_id: studentId,
      author_id: user.id,
      author_kind: access.kind,
      body: trimmed,
      status: 'open',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await logSchoolAction('lms_question_asked', {
    metadata: {
      lessonId,
      studentId,
      questionId: inserted.id,
      authorKind: access.kind,
    },
  })

  // Revalidate inbox pages
  revalidatePath('/dashboard/lms/questions')
  return { success: true, id: inserted.id }
}

/** Reply to an existing thread (root message). */
export async function replyToThread({ rootId, body }: { rootId: string; body: string }) {
  const { user, schoolId } = await getContext()

  const trimmed = body.trim()
  if (trimmed.length === 0 || trimmed.length > 2000) {
    return { error: 'Reply must be 1‑2000 characters.' }
  }

  // Load root message using admin client
  const admin = createAdminClient() as any
  const { data: root, error: rootErr } = await admin
    .from('lms_lesson_messages')
    .select('id, lesson_id, student_id, status, author_id, author_kind, school_id')
    .eq('id', rootId)
    .eq('school_id', schoolId)
    .is('parent_id', null)
    .single()

  if (rootErr || !root) {
    console.error('[replyToThread] Thread not found in school:', { rootId, schoolId, rootErr })
    return { error: 'Not allowed.' }
  }

  // Load lesson for permission checks using admin client
  const { data: lesson, error: lessonErr } = await admin
    .from('lms_lessons')
    .select('id, class_id, subject_id, recorded_by')
    .eq('id', root.lesson_id)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson) {
    console.error('[replyToThread] Lesson not found for root message:', { lessonId: root.lesson_id, schoolId, lessonErr })
    return { error: 'Not allowed.' }
  }

  // Authorization: either the original asker (author_id) or someone authorized to answer this lesson
  const isAsker = root.author_id === user.id && root.author_kind !== 'staff'
  const canAnswer = await canAnswerLesson(user.id, lesson)
  if (!isAsker && !canAnswer) {
    console.warn('[replyToThread] Authorization failed:', { userId: user.id, isAsker, canAnswer })
    return { error: 'Not allowed.' }
  }

  // Insert reply (parent_id = root.id, student_id = null per lms_msg_shape)
  const { data: replyInserted, error: replyErr } = await admin
    .from('lms_lesson_messages')
    .insert({
      school_id: schoolId,
      lesson_id: root.lesson_id,
      parent_id: root.id,
      student_id: null,
      author_id: user.id,
      author_kind: isAsker ? root.author_kind : 'staff',
      body: trimmed,
      status: null,
    })
    .select('id')
    .single()

  if (replyErr) return { error: replyErr.message }

  // Update root status if needed:
  // Replying by staff sets the thread to answered; if asker replies when answered, it reverts to open.
  let newStatus = root.status
  if (!isAsker) {
    newStatus = 'answered'
  } else if (root.status === 'answered') {
    newStatus = 'open'
  }

  if (newStatus !== root.status) {
    await admin
      .from('lms_lesson_messages')
      .update({ status: newStatus })
      .eq('id', root.id)
      .eq('school_id', schoolId)
  }

  await logSchoolAction('lms_question_replied', {
    metadata: {
      rootId,
      replyId: replyInserted.id,
      byStaff: !isAsker,
    },
  })

  revalidatePath('/dashboard/lms/questions')
  revalidatePath(`/dashboard/lms/questions/${rootId}`)
  return { success: true, replyId: replyInserted.id }
}

/** Change thread status (open/closed). */
export async function setThreadStatus({ rootId, status }: { rootId: string; status: 'open' | 'closed' }) {
  const { user, schoolId } = await getContext()

  const admin = createAdminClient() as any
  const { data: root, error } = await admin
    .from('lms_lesson_messages')
    .select('id, lesson_id, status, author_id, school_id')
    .eq('id', rootId)
    .eq('school_id', schoolId)
    .is('parent_id', null)
    .single()

  if (error || !root) {
    console.error('[setThreadStatus] Thread not found:', { rootId, schoolId, error })
    return { error: 'Not allowed.' }
  }

  const { data: lesson, error: lessonErr } = await admin
    .from('lms_lessons')
    .select('id, class_id, subject_id, recorded_by')
    .eq('id', root.lesson_id)
    .eq('school_id', schoolId)
    .single()

  if (lessonErr || !lesson) {
    console.error('[setThreadStatus] Lesson not found:', { lessonId: root.lesson_id, schoolId, lessonErr })
    return { error: 'Not allowed.' }
  }

  const isAuthor = root.author_id === user.id
  const canAnswer = await canAnswerLesson(user.id, lesson)

  if (!isAuthor && !canAnswer) {
    console.warn('[setThreadStatus] Authorization failed:', { userId: user.id, isAuthor, canAnswer })
    return { error: 'Not allowed.' }
  }

  const { error: updErr } = await admin
    .from('lms_lesson_messages')
    .update({ status })
    .eq('id', root.id)
    .eq('school_id', schoolId)

  if (updErr) return { error: updErr.message }

  await logSchoolAction('lms_thread_status_changed', {
    metadata: { rootId, status },
  })

  revalidatePath('/dashboard/lms/questions')
  revalidatePath(`/dashboard/lms/questions/${rootId}`)
  return { success: true }
}

/** List the calling user's own threads for a lesson/student (asker view). */
export async function listMyThreads({ lessonId, studentId }: { lessonId: string; studentId: string }) {
  const { user, schoolId } = await getContext()

  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) return { error: 'Not authorized.' }

  const admin = createAdminClient() as any
  const { data: roots, error } = await admin
    .from('lms_lesson_messages')
    .select('id, body, status, created_at')
    .eq('school_id', schoolId)
    .eq('lesson_id', lessonId)
    .eq('student_id', studentId)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  const threads = await Promise.all(
    (roots ?? []).map(async (root: any) => {
      const { data: replies } = await admin
        .from('lms_lesson_messages')
        .select(`
          id,
          body,
          created_at,
          author_id,
          author_kind,
          profiles:author_id (
            first_name,
            last_name
          )
        `)
        .eq('school_id', schoolId)
        .eq('parent_id', root.id)
        .order('created_at', { ascending: true })
      const enrichedReplies = (replies ?? []).map((r: any) => ({
        ...r,
        author_name: r.profiles
          ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim() || null
          : null,
      }))
      return { ...root, replies: enrichedReplies }
    })
  )

  return { threads }
}

/** List inbox threads for answerers (open/answered/closed/all). */
export async function listInboxThreads({
  filter = 'open',
  lessonId,
}: {
  filter?: 'open' | 'answered' | 'closed' | 'all'
  lessonId?: string
} = {}) {
  const { user, schoolId } = await getContext()

  const answerableIds = await getAnswerableLessonIds(user.id)
  if (answerableIds.length === 0) return { threads: [] }

  const admin = createAdminClient() as any
  let query = admin
    .from('lms_lesson_messages')
    .select(`
      id,
      lesson_id,
      student_id,
      author_id,
      author_kind,
      status,
      body,
      created_at,
      lms_lessons (
        id,
        title,
        class_id,
        subject_id,
        classes:class_id ( name ),
        subjects:subject_id ( name )
      ),
      students (
        id,
        first_name,
        last_name
      )
    `)
    .eq('school_id', schoolId)
    .is('parent_id', null)

  if (lessonId) {
    if (!answerableIds.includes(lessonId)) {
      return { threads: [] }
    }
    query = query.eq('lesson_id', lessonId)
  } else {
    query = query.in('lesson_id', answerableIds)
  }

  if (filter && filter !== 'all') {
    query = query.eq('status', filter)
  }

  const { data: roots, error } = await query
  if (error) return { error: error.message }

  // Sorting: Open first, then newest first
  const statusPriority: Record<string, number> = {
    open: 0,
    answered: 1,
    closed: 2,
  }

  const sorted = [...(roots ?? [])].sort((a: any, b: any) => {
    const aPri = statusPriority[a.status] ?? 3
    const bPri = statusPriority[b.status] ?? 3
    if (aPri !== bPri) return aPri - bPri
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const enriched = sorted.map((root: any) => {
    const studentName = `${root.students?.first_name ?? ''} ${root.students?.last_name ?? ''}`.trim() || 'Student'
    const askerDisplay = root.author_kind === 'guardian'
      ? `Asked by parent of ${studentName}`
      : `Asked by ${studentName}`

    const className = root.lms_lessons?.classes?.name ?? ''
    const subjectName = root.lms_lessons?.subjects?.name ?? ''
    const classSubject = [className, subjectName].filter(Boolean).join(' · ')

    return {
      id: root.id,
      lessonId: root.lesson_id,
      lessonTitle: root.lms_lessons?.title ?? 'Untitled Lesson',
      classSubject,
      className,
      subjectName,
      studentName,
      askerDisplay,
      authorKind: root.author_kind,
      status: root.status as 'open' | 'answered' | 'closed',
      snippet: root.body.length > 140 ? root.body.slice(0, 140) + '…' : root.body,
      createdAt: root.created_at,
    }
  })

  return { threads: enriched }
}

/** Get a single thread with its replies (answerer or author). */
export async function getThread(rootId: string) {
  const { supabase, user, schoolId } = await getContext()

  const admin = createAdminClient() as any
  const { data: root, error } = await admin
    .from('lms_lesson_messages')
    .select(`
      id,
      lesson_id,
      student_id,
      author_id,
      author_kind,
      status,
      body,
      created_at,
      school_id,
      lms_lessons (
        id,
        title,
        topic,
        week_no,
        class_id,
        subject_id,
        recorded_by,
        classes:class_id ( name ),
        subjects:subject_id ( name )
      ),
      students (
        id,
        first_name,
        last_name
      )
    `)
    .eq('id', rootId)
    .eq('school_id', schoolId)
    .is('parent_id', null)
    .single()

  if (error || !root) {
    console.error('[getThread] Thread not found:', { rootId, schoolId, error })
    return { error: 'Not allowed.' }
  }

  const lesson = root.lms_lessons
  const isAuthor = root.author_id === user.id
  const canAnswer = lesson ? await canAnswerLesson(user.id, lesson) : false
  if (!isAuthor && !canAnswer) {
    console.warn('[getThread] Authorization failed:', { userId: user.id, rootId, isAuthor, canAnswer })
    return { error: 'Not allowed.' }
  }

  const [{ data: canManage }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
  ])

  // Load replies with profile names
  const { data: replies, error: replyErr } = await admin
    .from('lms_lesson_messages')
    .select(`
      id,
      body,
      created_at,
      author_id,
      author_kind,
      profiles:author_id (
        first_name,
        last_name
      )
    `)
    .eq('parent_id', root.id)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: true })

  if (replyErr) return { error: replyErr.message }

  const studentName = `${root.students?.first_name ?? ''} ${root.students?.last_name ?? ''}`.trim() || 'Student'
  const askerDisplay = root.author_kind === 'guardian'
    ? `Asked by parent of ${studentName}`
    : `Asked by ${studentName}`

  return {
    root: {
      ...root,
      studentName,
      askerDisplay,
    },
    replies: (replies ?? []).map((r: any) => ({
      ...r,
      authorName: r.profiles ? `${r.profiles.first_name ?? ''} ${r.profiles.last_name ?? ''}`.trim() : null,
    })),
    canManage: Boolean(canManage),
    canAnswer: Boolean(canAnswer),
  }
}

/** Delete a message (staff only with lms.manage). */
export async function deleteMessage(messageId: string) {
  const { supabase, user, schoolId } = await getContext()

  const [{ data: canManage }] = await Promise.all([
    supabase.rpc('has_permission', { perm_code: 'lms.manage' }),
  ])
  if (!canManage) return { error: 'Permission denied.' }

  const admin = createAdminClient() as any

  // If this message is a root message, delete replies first
  await admin
    .from('lms_lesson_messages')
    .delete()
    .eq('parent_id', messageId)
    .eq('school_id', schoolId)

  const { data, error } = await admin
    .from('lms_lesson_messages')
    .delete()
    .eq('id', messageId)
    .eq('school_id', schoolId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) return { error: 'Message not found.' }

  await logSchoolAction('lms_message_deleted', { metadata: { messageId } })
  revalidatePath('/dashboard/lms/questions')
  return { success: true }
}

/** Count of open questions the caller may answer (for badge). */
export async function getOpenQuestionCount() {
  const { user, schoolId } = await getContext()
  const answerableIds = await getAnswerableLessonIds(user.id)
  if (answerableIds.length === 0) return { count: 0 }

  const admin = createAdminClient() as any
  const { count, error } = await admin
    .from('lms_lesson_messages')
    .select('*', { count: 'exact', head: true })
    .eq('school_id', schoolId)
    .in('lesson_id', answerableIds)
    .is('parent_id', null)
    .eq('status', 'open')

  if (error) return { count: 0 }
  return { count: count ?? 0 }
}
