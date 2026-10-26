/* eslint-disable @typescript-eslint/no-explicit-any */
'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { logSchoolAction } from '@/lib/audit/log-school-actions'
import { canManageActivitiesLegacy as canManageActivities, canViewActivityResults, getAskerAccess } from '@/app/dashboard/lms/access'
import { removeStorageDirectory } from '../storage-utils'
import { randomUUID } from 'crypto'

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

// ─── 1. createActivity ────────────────────────────────────────────────────────

export async function createActivity(input: {
  lessonId: string
  kind: 'quiz' | 'assignment'
  title: string
  instructions?: string | null
  dueAt?: string | null
  timeLimitMinutes?: number | null
  attemptsAllowed?: number | null
  showAnswers?: boolean
  maxScore?: number
}) {
  const { user, schoolId } = await getContext()

  const allowed = await canManageActivities(user.id, input.lessonId)
  if (!allowed) {
    return { error: 'Permission denied: cannot manage activities for this lesson.' }
  }

  const title = input.title?.trim()
  if (!title) {
    return { error: 'Title is required.' }
  }

  // max_score check constraint requires max_score >= 1.
  // For quizzes, it will be updated when questions are added (default to 1 initially).
  let maxScore = Number(input.maxScore) || 1
  if (input.kind === 'assignment') {
    if (maxScore < 1) maxScore = 10
  } else {
    maxScore = Math.max(1, maxScore)
  }

  const admin = createAdminClient()
  const { data: activity, error } = await (admin as any)
    .from('lms_activities')
    .insert({
      school_id: schoolId,
      lesson_id: input.lessonId,
      kind: input.kind,
      title,
      status: 'draft',
      created_by: user.id,
      instructions: input.instructions?.trim() || null,
      due_at: input.dueAt ? new Date(input.dueAt).toISOString() : null,
      time_limit_minutes: input.kind === 'quiz' && input.timeLimitMinutes ? Math.max(1, Number(input.timeLimitMinutes)) : null,
      attempts_allowed: input.kind === 'quiz' && input.attemptsAllowed ? Math.max(1, Number(input.attemptsAllowed)) : 1,
      show_answers: input.kind === 'quiz' ? !!input.showAnswers : false,
      max_score: maxScore
    })
    .select()
    .single()

  if (error || !activity) {
    return { error: error?.message || 'Failed to create activity.' }
  }

  await logSchoolAction('lms.activity.created' as any, {
    metadata: { activity_id: activity.id, lesson_id: input.lessonId, kind: input.kind, title }
  })

  revalidatePath(`/dashboard/lms/${input.lessonId}`)
  return { success: true, activity }
}

// ─── 2. updateActivity ────────────────────────────────────────────────────────

export async function updateActivity(
  activityId: string,
  updates: {
    title?: string
    instructions?: string | null
    dueAt?: string | null
    timeLimitMinutes?: number | null
    attemptsAllowed?: number | null
    showAnswers?: boolean
    maxScore?: number
  }
) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return { error: 'Activity not found.' }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) return { error: 'Permission denied.' }

  // Check if submissions exist
  const { count: submissionCount } = await (admin as any)
    .from('lms_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('school_id', schoolId)

  const hasSubmissions = (submissionCount ?? 0) > 0

  const payload: any = {}
  if (updates.title !== undefined) {
    const t = updates.title.trim()
    if (!t) return { error: 'Title cannot be empty.' }
    payload.title = t
  }
  if (updates.instructions !== undefined) {
    payload.instructions = updates.instructions?.trim() || null
  }
  if (updates.dueAt !== undefined) {
    payload.due_at = updates.dueAt ? new Date(updates.dueAt).toISOString() : null
  }

  if (activity.kind === 'quiz') {
    if (updates.showAnswers !== undefined) {
      payload.show_answers = !!updates.showAnswers
    }
    // Block setting time_limit_minutes or attempts_allowed if submissions exist
    if (updates.timeLimitMinutes !== undefined) {
      if (hasSubmissions) {
        return { error: 'Cannot change time limit after submissions have been made.' }
      }
      payload.time_limit_minutes = updates.timeLimitMinutes ? Math.max(1, Number(updates.timeLimitMinutes)) : null
    }
    if (updates.attemptsAllowed !== undefined) {
      if (hasSubmissions) {
        return { error: 'Cannot change allowed attempts after submissions have been made.' }
      }
      payload.attempts_allowed = updates.attemptsAllowed ? Math.max(1, Number(updates.attemptsAllowed)) : 1
    }
  } else {
    // Assignment maxScore
    if (updates.maxScore !== undefined) {
      if (hasSubmissions) {
        return { error: 'Cannot change maximum score after submissions have been made.' }
      }
      const score = Number(updates.maxScore)
      if (score < 1) return { error: 'Max score must be at least 1.' }
      payload.max_score = score
    }
  }

  const { data: updated, error } = await (admin as any)
    .from('lms_activities')
    .update(payload)
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error || !updated) {
    return { error: error?.message || 'Failed to update activity.' }
  }

  await logSchoolAction('lms.activity.updated' as any, {
    metadata: { activity_id: activityId, lesson_id: activity.lesson_id }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true, activity: updated }
}

// ─── 3. saveQuizQuestions ─────────────────────────────────────────────────────

export async function saveQuizQuestions(
  activityId: string,
  questions: Array<{
    position: number
    prompt: string
    options: string[]
    correct_index: number
    marks: number
    explanation?: string | null
  }>
) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return { error: 'Activity not found.' }
  if (activity.kind !== 'quiz') return { error: 'This activity is not a quiz.' }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) return { error: 'Permission denied.' }

  // Block question changes if any submissions exist
  const { count: submissionCount } = await (admin as any)
    .from('lms_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('school_id', schoolId)

  if ((submissionCount ?? 0) > 0) {
    return { error: 'Cannot modify quiz questions because submissions have already been received.' }
  }

  if (!questions || questions.length === 0) {
    return { error: 'A quiz must have at least one question.' }
  }

  let totalMarks = 0
  const rowsToInsert = []

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const prompt = q.prompt?.trim()
    if (!prompt) return { error: `Question ${i + 1} is missing a prompt.` }

    const options = (q.options || []).map(o => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
    if (options.length < 2 || options.length > 6) {
      return { error: `Question ${i + 1} must have between 2 and 6 options.` }
    }

    const correctIndex = Number(q.correct_index)
    if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      return { error: `Question ${i + 1} must have a valid correct option selected.` }
    }

    const marks = Number(q.marks) || 1
    if (marks < 1) return { error: `Question ${i + 1} marks must be at least 1.` }
    totalMarks += marks

    rowsToInsert.push({
      school_id: schoolId,
      activity_id: activityId,
      position: i + 1,
      prompt,
      options,
      correct_index: correctIndex,
      marks,
      explanation: q.explanation?.trim() || null
    })
  }

  // Delete existing questions
  const { error: delError } = await (admin as any)
    .from('lms_quiz_questions')
    .delete()
    .eq('activity_id', activityId)
    .eq('school_id', schoolId)

  if (delError) {
    return { error: delError.message || 'Failed to clear old questions.' }
  }

  // Insert new questions
  const { error: insError } = await (admin as any)
    .from('lms_quiz_questions')
    .insert(rowsToInsert)

  if (insError) {
    return { error: insError.message || 'Failed to save questions.' }
  }

  // Update activity max_score to sum of marks
  await (admin as any)
    .from('lms_activities')
    .update({ max_score: totalMarks })
    .eq('id', activityId)
    .eq('school_id', schoolId)

  await logSchoolAction('lms.activity.questions_updated' as any, {
    metadata: { activity_id: activityId, total_marks: totalMarks, question_count: rowsToInsert.length }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true, count: rowsToInsert.length, totalMarks }
}

// ─── 4. setActivityStatus ─────────────────────────────────────────────────────

export async function setActivityStatus(activityId: string, status: 'draft' | 'published') {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return { error: 'Activity not found.' }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) return { error: 'Permission denied.' }

  if (status === 'published' && activity.kind === 'quiz') {
    // Check questions count
    const { count } = await (admin as any)
      .from('lms_quiz_questions')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activityId)
      .eq('school_id', schoolId)

    if (!count || count === 0) {
      return { error: 'A quiz must have at least one question before it can be published.' }
    }
  }

  const { error } = await (admin as any)
    .from('lms_activities')
    .update({ status })
    .eq('id', activityId)
    .eq('school_id', schoolId)

  if (error) return { error: error.message }

  await logSchoolAction('lms.activity.status_changed' as any, {
    metadata: { activity_id: activityId, new_status: status }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true, status }
}

// ─── 5. deleteActivity ────────────────────────────────────────────────────────

export async function deleteActivity(activityId: string) {
  const { supabase, schoolId } = await getContext()

  // Hard spec requirement: lms.manage only for delete
  const { data: canManage } = await supabase.rpc('has_permission', { perm_code: 'lms.manage' })
  if (!canManage) {
    return { error: 'Permission denied: only managers can delete activities.' }
  }

  const admin = createAdminClient()
  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return { error: 'Activity not found.' }

  // Remove files from lms-submissions bucket
  try {
    const res = await removeStorageDirectory(admin, 'lms-submissions', `${schoolId}/${activityId}`)
    if (res.error) {
      console.error('Failed to clean up submission storage files:', res.error)
    }
  } catch (err) {
    console.error('Failed to clean up submission storage files:', err)
  }

  // Delete questions and submissions first to ensure clean cascade
  await (admin as any).from('lms_quiz_questions').delete().eq('activity_id', activityId).eq('school_id', schoolId)
  await (admin as any).from('lms_submissions').delete().eq('activity_id', activityId).eq('school_id', schoolId)

  const { error } = await (admin as any)
    .from('lms_activities')
    .delete()
    .eq('id', activityId)
    .eq('school_id', schoolId)

  if (error) return { error: error.message }

  await logSchoolAction('lms.activity.deleted' as any, {
    metadata: { activity_id: activityId, lesson_id: activity.lesson_id }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  return { success: true }
}

// ─── 6. getActivity & getQuizQuestions ────────────────────────────────────────

export async function getActivity(activityId: string) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return null

  const canManage = await canManageActivities(user.id, activity.lesson_id)
  const canView = await canViewActivityResults(user.id, activity.lesson_id)

  let questions: any[] = []
  if (activity.kind === 'quiz' && (canManage || canView)) {
    const { data: qData } = await (admin as any)
      .from('lms_quiz_questions')
      .select('*')
      .eq('activity_id', activityId)
      .eq('school_id', schoolId)
      .order('position', { ascending: true })
    questions = qData || []
  }

  return {
    activity,
    canManage,
    canView,
    questions
  }
}

// ─── 7. listActivitiesForLearner ──────────────────────────────────────────────

export async function listActivitiesForLearner(lessonId: string, studentId: string) {
  const { user, schoolId } = await getContext()

  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) return { error: 'Access denied to this lesson.' }

  const admin = createAdminClient()

  const { data: activities, error } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, kind, title, instructions, due_at, time_limit_minutes, attempts_allowed, show_answers, max_score, created_at, attachment_name, attachment_path')
    .eq('lesson_id', lessonId)
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  // Fetch submissions for this student
  const { data: submissions } = await (admin as any)
    .from('lms_submissions')
    .select('id, activity_id, attempt_no, status, score, max_score, submitted_at, started_at, is_late, feedback')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)

  const subsByActivity: Record<string, any[]> = {}
  for (const s of (submissions || [])) {
    if (!subsByActivity[s.activity_id]) subsByActivity[s.activity_id] = []
    subsByActivity[s.activity_id].push(s)
  }

  const enriched = (activities || []).map((act: any) => {
    const userSubs = subsByActivity[act.id] || []
    const attemptsCount = userSubs.filter(s => s.status !== 'in_progress').length
    const hasInProgress = userSubs.some(s => s.status === 'in_progress')
    const bestScore = userSubs.reduce((best, s) => (s.score != null && s.score > best ? s.score : best), 0)
    const latestSub = userSubs.sort((a, b) => new Date(b.submitted_at || b.started_at).getTime() - new Date(a.submitted_at || a.started_at).getTime())[0]

    return {
      ...act,
      hasBrief: !!act.attachment_path,
      briefName: act.attachment_name || null,
      attachment_path: undefined,
      submissions: userSubs,
      attemptsCount,
      hasInProgress,
      bestScore: userSubs.some(s => s.score != null) ? bestScore : null,
      latestSubmission: latestSub || null
    }
  })

  return { success: true, activities: enriched, lesson: access.lesson }
}

// ─── 8. startQuizAttempt ──────────────────────────────────────────────────────

export async function startQuizAttempt(activityId: string, studentId: string) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .maybeSingle()

  if (!activity || activity.kind !== 'quiz') {
    return { error: 'Quiz not found or not published.' }
  }

  const access = await getAskerAccess(user.id, activity.lesson_id, studentId)
  if (!access) return { error: 'Access denied.' }

  // Check for in_progress attempt
  const { data: inProgress } = await (admin as any)
    .from('lms_submissions')
    .select('*')
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .eq('status', 'in_progress')
    .maybeSingle()

  // Fetch questions (strip correct_index and explanation!)
  const { data: rawQuestions } = await (admin as any)
    .from('lms_quiz_questions')
    .select('id, position, prompt, options, marks')
    .eq('activity_id', activityId)
    .eq('school_id', schoolId)
    .order('position', { ascending: true })

  const sanitizedQuestions = (rawQuestions || []).map((q: any) => ({
    id: q.id,
    position: q.position,
    prompt: q.prompt,
    options: q.options,
    marks: q.marks
  }))

  if (inProgress) {
    return {
      success: true,
      submission: inProgress,
      activity: {
        id: activity.id,
        title: activity.title,
        instructions: activity.instructions,
        time_limit_minutes: activity.time_limit_minutes,
        due_at: activity.due_at,
        max_score: activity.max_score
      },
      questions: sanitizedQuestions
    }
  }

  // Count existing finished attempts
  const { count: completedCount } = await (admin as any)
    .from('lms_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .neq('status', 'in_progress')

  const attemptsAllowed = activity.attempts_allowed || 1
  if ((completedCount ?? 0) >= attemptsAllowed) {
    return { error: `Maximum allowed attempts (${attemptsAllowed}) reached for this quiz.` }
  }

  // Create new attempt
  const { data: newSubmission, error } = await (admin as any)
    .from('lms_submissions')
    .insert({
      school_id: schoolId,
      activity_id: activityId,
      student_id: studentId,
      submitted_by: user.id,
      attempt_no: (completedCount ?? 0) + 1,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      is_late: false,
      max_score: activity.max_score
    })
    .select()
    .single()

  if (error || !newSubmission) {
    return { error: error?.message || 'Could not start quiz attempt.' }
  }

  return {
    success: true,
    submission: newSubmission,
    activity: {
      id: activity.id,
      title: activity.title,
      instructions: activity.instructions,
      time_limit_minutes: activity.time_limit_minutes,
      due_at: activity.due_at,
      max_score: activity.max_score
    },
    questions: sanitizedQuestions
  }
}

// ─── 9. submitQuizAttempt ─────────────────────────────────────────────────────

export async function submitQuizAttempt(submissionId: string, answers: Record<string, number>) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: submission } = await (admin as any)
    .from('lms_submissions')
    .select('*')
    .eq('id', submissionId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!submission) return { error: 'Attempt not found.' }

  // Idempotent: if already marked, return current result
  if (submission.status === 'marked') {
    return {
      success: true,
      alreadySubmitted: true,
      score: submission.score,
      maxScore: submission.max_score,
      submission
    }
  }

  // Verify caller is the submitter or student/guardian
  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', submission.activity_id)
    .eq('school_id', schoolId)
    .single()

  const access = await getAskerAccess(user.id, activity.lesson_id, submission.student_id)
  if (!access) return { error: 'Access denied.' }

  // Load all questions with correct_index to grade
  const { data: questions } = await (admin as any)
    .from('lms_quiz_questions')
    .select('id, marks, correct_index, prompt, options, explanation')
    .eq('activity_id', activity.id)
    .eq('school_id', schoolId)
    .order('position', { ascending: true })

  let totalScore = 0
  for (const q of (questions || [])) {
    const selected = answers[q.id]
    if (selected !== undefined && Number(selected) === Number(q.correct_index)) {
      totalScore += Number(q.marks) || 0
    }
  }

  const now = new Date()
  let isLate = false
  if (activity.due_at) {
    // 2 minutes grace period for clock drift
    const dueTime = new Date(activity.due_at).getTime() + 2 * 60 * 1000
    if (now.getTime() > dueTime) {
      isLate = true
    }
  }

  const { data: updated, error } = await (admin as any)
    .from('lms_submissions')
    .update({
      answers,
      score: totalScore,
      max_score: activity.max_score,
      status: 'marked',
      submitted_at: now.toISOString(),
      is_late: isLate
    })
    .eq('id', submissionId)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error || !updated) {
    return { error: error?.message || 'Failed to submit quiz.' }
  }

  revalidatePath(`/dashboard/lms/learn/${activity.lesson_id}`)

  return {
    success: true,
    score: totalScore,
    maxScore: activity.max_score,
    isLate,
    showAnswers: !!activity.show_answers,
    questions: activity.show_answers ? questions : undefined,
    submission: updated
  }
}

// ─── 10. getAssignmentUploadUrl ───────────────────────────────────────────────

export async function getAssignmentUploadUrl(
  activityId: string,
  studentId: string,
  fileName: string,
  mimeType: string,
  fileSize: number
) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, status')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity || activity.status !== 'published') {
    return { error: 'Activity not found or not published.' }
  }

  const access = await getAskerAccess(user.id, activity.lesson_id, studentId)
  if (!access) return { error: 'Access denied.' }

  // Max 20MB
  if (fileSize > 20 * 1024 * 1024) {
    return { error: 'File size must be under 20MB.' }
  }

  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${schoolId}/${activityId}/${studentId}/${Date.now()}_${cleanName}`

  const { data, error } = await admin.storage
    .from('lms-submissions')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return { error: error?.message || 'Failed to generate upload URL.' }
  }

  return {
    success: true,
    signedUrl: data.signedUrl,
    token: data.token,
    path: storagePath
  }
}

// ─── 11. submitAssignment ─────────────────────────────────────────────────────

export async function submitAssignment(
  activityId: string,
  studentId: string,
  data: { textResponse?: string; attachmentPath?: string }
) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .eq('status', 'published')
    .maybeSingle()

  if (!activity || activity.kind !== 'assignment') {
    return { error: 'Assignment not found or not published.' }
  }

  const access = await getAskerAccess(user.id, activity.lesson_id, studentId)
  if (!access) return { error: 'Access denied.' }

  const textResponse = data.textResponse?.trim() || null
  const attachmentPath = data.attachmentPath?.trim() || null

  if (!textResponse && !attachmentPath) {
    return { error: 'Please provide either a text response or an attached file.' }
  }

  // Check existing submission
  const { data: existing } = await (admin as any)
    .from('lms_submissions')
    .select('*')
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (existing && existing.status === 'marked') {
    return { error: 'This assignment has already been marked and cannot be resubmitted.' }
  }

  const now = new Date()
  let isLate = false
  if (activity.due_at) {
    const dueTime = new Date(activity.due_at).getTime() + 2 * 60 * 1000
    if (now.getTime() > dueTime) {
      isLate = true
    }
  }

  let submission: any
  if (existing) {
    const { data: updated, error } = await (admin as any)
      .from('lms_submissions')
      .update({
        submitted_by: user.id,
        status: 'submitted',
        submitted_at: now.toISOString(),
        text_response: textResponse,
        attachment_path: attachmentPath,
        max_score: activity.max_score,
        is_late: isLate
      })
      .eq('id', existing.id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) return { error: error.message }
    submission = updated
  } else {
    const { data: inserted, error } = await (admin as any)
      .from('lms_submissions')
      .insert({
        school_id: schoolId,
        activity_id: activityId,
        student_id: studentId,
        submitted_by: user.id,
        attempt_no: 1,
        status: 'submitted',
        started_at: now.toISOString(),
        submitted_at: now.toISOString(),
        text_response: textResponse,
        attachment_path: attachmentPath,
        max_score: activity.max_score,
        is_late: isLate
      })
      .select()
      .single()

    if (error) return { error: error.message }
    submission = inserted
  }

  revalidatePath(`/dashboard/lms/learn/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true, submission }
}

// ─── 12. listSubmissions (Teacher Roster) ──────────────────────────────────────

export async function listSubmissions(activityId: string) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*, lesson:lms_lessons(id, title, class_id, subject_id, class:classes(name), subject:subjects(name))')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity) return { error: 'Activity not found.' }

  const canView = await canViewActivityResults(user.id, activity.lesson_id)
  if (!canView) return { error: 'Access denied.' }

  // Load current session
  const { data: session } = await (admin as any)
    .from('academic_sessions')
    .select('id, name')
    .eq('school_id', schoolId)
    .eq('is_current', true)
    .maybeSingle()

  // Load enrolled students in that class
  const classId = activity.lesson?.class_id
  let students: any[] = []
  if (session && classId) {
    const { data: enrolments } = await (admin as any)
      .from('enrolments')
      .select('student_id, student:students(id, admission_number, profile:profiles(first_name, last_name, avatar_url))')
      .eq('school_id', schoolId)
      .eq('session_id', session.id)
      .eq('class_id', classId)

    students = (enrolments || []).map((e: any) => e.student).filter(Boolean)
  }

  // Load all submissions for this activity
  const { data: submissions } = await (admin as any)
    .from('lms_submissions')
    .select('*')
    .eq('activity_id', activityId)
    .eq('school_id', schoolId)
    .order('submitted_at', { ascending: false })

  const subsByStudent: Record<string, any[]> = {}
  for (const s of (submissions || [])) {
    if (!subsByStudent[s.student_id]) subsByStudent[s.student_id] = []
    subsByStudent[s.student_id].push(s)
  }

  // Assemble roster rows
  const roster = students.map(st => {
    const stSubs = subsByStudent[st.id] || []
    if (activity.kind === 'quiz') {
      const completed = stSubs.filter(s => s.status === 'marked')
      const best = completed.reduce((b, s) => (s.score != null && s.score > b ? s.score : b), 0)
      const latest = stSubs[0] || null
      return {
        student: st,
        attemptsCount: completed.length,
        hasInProgress: stSubs.some(s => s.status === 'in_progress'),
        bestScore: completed.length > 0 ? best : null,
        latestSubmission: latest,
        allSubmissions: stSubs
      }
    } else {
      const sub = stSubs[0] || null
      return {
        student: st,
        submission: sub
      }
    }
  })

  return {
    success: true,
    activity,
    session,
    roster,
    totalEnrolled: students.length,
    submittedCount: Object.keys(subsByStudent).length
  }
}

// ─── 13. getSubmission ────────────────────────────────────────────────────────

export async function getSubmission(submissionId: string) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: submission } = await (admin as any)
    .from('lms_submissions')
    .select('*, activity:lms_activities(*), student:students(id, admission_number, profile:profiles(first_name, last_name))')
    .eq('id', submissionId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!submission) return null

  // Authorization check: teacher with result access OR learner
  const canView = await canViewActivityResults(user.id, submission.activity.lesson_id)
  let allowed = canView
  if (!allowed) {
    const access = await getAskerAccess(user.id, submission.activity.lesson_id, submission.student_id)
    allowed = !!access
  }

  if (!allowed) return null

  let downloadUrl: string | null = null
  if (submission.attachment_path) {
    const { data: signed } = await admin.storage
      .from('lms-submissions')
      .createSignedUrl(submission.attachment_path, 600)
    downloadUrl = signed?.signedUrl || null
  }

  return {
    ...submission,
    downloadUrl
  }
}

// ─── 14. markSubmission ───────────────────────────────────────────────────────

export async function markSubmission(
  submissionId: string,
  data: { score: number; feedback?: string }
) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: submission } = await (admin as any)
    .from('lms_submissions')
    .select('id, activity_id, max_score, activity:lms_activities(lesson_id, max_score)')
    .eq('id', submissionId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!submission) return { error: 'Submission not found.' }

  const allowed = await canViewActivityResults(user.id, submission.activity.lesson_id)
  if (!allowed) return { error: 'Permission denied.' }

  const maxAllowed = submission.activity?.max_score ?? submission.max_score ?? 100
  const score = Number(data.score)

  if (isNaN(score) || score < 0 || score > maxAllowed) {
    return { error: `Score must be between 0 and ${maxAllowed}.` }
  }

  const { data: updated, error } = await (admin as any)
    .from('lms_submissions')
    .update({
      score,
      feedback: data.feedback?.trim() || null,
      status: 'marked',
      marked_by: user.id,
      marked_at: new Date().toISOString()
    })
    .eq('id', submissionId)
    .eq('school_id', schoolId)
    .select()
    .single()

  if (error || !updated) {
    return { error: error?.message || 'Failed to update submission mark.' }
  }

  await logSchoolAction('lms.submission.marked' as any, {
    metadata: { submission_id: submissionId, score, activity_id: submission.activity_id }
  })

  revalidatePath(`/dashboard/lms/activities/${submission.activity_id}`)
  return { success: true, submission: updated }
}

// ─── 15. getBriefUploadUrl ────────────────────────────────────────────────────

export async function getBriefUploadUrl({
  activityId,
  fileName,
  mimeType,
  size,
}: {
  activityId: string
  fileName: string
  mimeType: string
  size: number
}) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, kind')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity || activity.kind !== 'assignment') {
    return { error: 'Assignment not found.' }
  }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) {
    return { error: 'Permission denied.' }
  }

  // Accept ONLY application/pdf, size <= 10MB
  if (mimeType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
    return { error: 'Only PDF documents are allowed for the assignment brief.' }
  }

  if (size > 10 * 1024 * 1024) {
    return { error: 'File size must not exceed 10MB.' }
  }

  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.pdf$/i, '')
  const storagePath = `${schoolId}/${activityId}/_brief/${randomUUID()}-${sanitizedName}.pdf`

  const { data, error } = await admin.storage
    .from('lms-submissions')
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    return { error: error?.message || 'Failed to generate upload URL.' }
  }

  return {
    success: true,
    path: storagePath,
    token: data.token,
    signedUrl: data.signedUrl,
  }
}

// ─── 16. setActivityBrief ─────────────────────────────────────────────────────

export async function setActivityBrief({
  activityId,
  attachmentPath,
  attachmentName,
}: {
  activityId: string
  attachmentPath: string
  attachmentName: string
}) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, kind, attachment_path')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity || activity.kind !== 'assignment') {
    return { error: 'Assignment not found.' }
  }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) {
    return { error: 'Permission denied.' }
  }

  // Verify attachmentPath starts with ${school_id}/${activityId}/_brief/
  const expectedPrefix = `${schoolId}/${activityId}/_brief/`
  if (!attachmentPath || !attachmentPath.startsWith(expectedPrefix)) {
    return { error: 'Invalid attachment path.' }
  }

  // Verify the object actually exists in the bucket
  const dir = `${schoolId}/${activityId}/_brief`
  const fileNameOnly = attachmentPath.substring(dir.length + 1)
  const { data: listFiles } = await admin.storage
    .from('lms-submissions')
    .list(dir, { search: fileNameOnly })

  const exists = (listFiles ?? []).some((f: any) => f.name === fileNameOnly)
  if (!exists) {
    return { error: 'Uploaded file could not be verified in storage.' }
  }

  // If a different brief was previously stored, remove the old object and check result
  if (activity.attachment_path && activity.attachment_path !== attachmentPath) {
    const { error: removeOldErr } = await admin.storage
      .from('lms-submissions')
      .remove([activity.attachment_path])
    if (removeOldErr) {
      console.error('Failed to remove previous brief object:', removeOldErr.message)
    }
  }

  const sanitizedName = attachmentName?.trim().slice(0, 255) || 'assignment-brief.pdf'

  const { error: updateErr } = await (admin as any)
    .from('lms_activities')
    .update({
      attachment_path: attachmentPath,
      attachment_name: sanitizedName,
    })
    .eq('id', activityId)
    .eq('school_id', schoolId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  await logSchoolAction('lms.activity.brief_attached' as any, {
    metadata: { activity_id: activityId, lesson_id: activity.lesson_id, attachment_name: sanitizedName }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true, attachmentPath, attachmentName: sanitizedName }
}

// ─── 17. removeActivityBrief ──────────────────────────────────────────────────

export async function removeActivityBrief(activityId: string) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, kind, attachment_path')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity || activity.kind !== 'assignment') {
    return { error: 'Assignment not found.' }
  }

  const allowed = await canManageActivities(user.id, activity.lesson_id)
  if (!allowed) {
    return { error: 'Permission denied.' }
  }

  if (activity.attachment_path) {
    const { error: remErr } = await admin.storage
      .from('lms-submissions')
      .remove([activity.attachment_path])
    if (remErr) {
      console.error('Failed to remove brief from storage:', remErr.message)
    }
  }

  const { error: updateErr } = await (admin as any)
    .from('lms_activities')
    .update({
      attachment_path: null,
      attachment_name: null,
    })
    .eq('id', activityId)
    .eq('school_id', schoolId)

  if (updateErr) {
    return { error: updateErr.message }
  }

  await logSchoolAction('lms.activity.brief_removed' as any, {
    metadata: { activity_id: activityId, lesson_id: activity.lesson_id }
  })

  revalidatePath(`/dashboard/lms/${activity.lesson_id}`)
  revalidatePath(`/dashboard/lms/activities/${activityId}`)
  return { success: true }
}

// ─── 18. getBriefDownloadUrl ──────────────────────────────────────────────────

export async function getBriefDownloadUrl({
  activityId,
  studentId,
}: {
  activityId: string
  studentId?: string
}) {
  const { user, schoolId } = await getContext()
  const admin = createAdminClient()

  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('id, lesson_id, kind, status, attachment_path, attachment_name')
    .eq('id', activityId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (!activity || !activity.attachment_path) {
    return { error: 'Assignment document not found.' }
  }

  // Authorization check:
  // (a) canManageActivities or canViewActivityResults
  const canManage = await canManageActivities(user.id, activity.lesson_id)
  const canView = await canViewActivityResults(user.id, activity.lesson_id)

  let isAllowed = canManage || canView

  // (b) learner via getAskerAccess (activity must be published)
  if (!isAllowed) {
    if (studentId && activity.status === 'published') {
      const access = await getAskerAccess(user.id, activity.lesson_id, studentId)
      if (access) {
        isAllowed = true
      }
    }
  }

  if (!isAllowed) {
    return { error: 'Access denied.' }
  }

  const downloadName = activity.attachment_name || 'assignment-brief.pdf'
  const { data: signed, error: signErr } = await admin.storage
    .from('lms-submissions')
    .createSignedUrl(activity.attachment_path, 600, {
      download: downloadName,
    })

  if (signErr || !signed?.signedUrl) {
    return { error: 'Failed to generate download URL.' }
  }

  return { url: signed.signedUrl }
}
