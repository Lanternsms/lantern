/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notificationUrl, isAllowedUrlForRecipient, type RecipientKind, type NotificationUrlContext } from '@/lib/notifications/urls'

export const dynamic = 'force-dynamic'

/**
 * Extracts context IDs (lesson, activity, question, batch, etc.) from a stored notification URL.
 */
function extractContextFromUrl(rawUrl: string | null | undefined): NotificationUrlContext {
  const ctx: NotificationUrlContext = {}
  if (!rawUrl || typeof rawUrl !== 'string') return ctx

  const qIndex = rawUrl.indexOf('?')
  const path = qIndex !== -1 ? rawUrl.slice(0, qIndex) : rawUrl
  const query = qIndex !== -1 ? rawUrl.slice(qIndex + 1) : ''

  if (query) {
    try {
      const sp = new URLSearchParams(query)
      if (sp.get('student')) ctx.studentId = sp.get('student')
      if (sp.get('child')) ctx.studentId = sp.get('child')
      if (sp.get('lessonId')) ctx.lessonId = sp.get('lessonId')
      if (sp.get('classSubjectId')) ctx.classSubjectId = sp.get('classSubjectId')
    } catch {
      // ignore query parsing errors
    }
  }

  const segments = path.split('/').filter(Boolean)
  // e.g. /dashboard/approvals/:id
  if (segments[0] === 'dashboard' && segments[1] === 'approvals' && segments[2]) {
    ctx.batchId = segments[2]
  }
  // e.g. /dashboard/gradebook/:id
  if (segments[0] === 'dashboard' && segments[1] === 'gradebook' && segments[2]) {
    ctx.classSubjectId = segments[2]
  }
  // e.g. /dashboard/lms/questions/:rootId
  if (segments[0] === 'dashboard' && segments[1] === 'lms' && segments[2] === 'questions' && segments[3]) {
    ctx.questionId = segments[3]
    ctx.threadId = segments[3]
  }
  // e.g. /dashboard/lms/activities/:activityId
  if (segments[0] === 'dashboard' && segments[1] === 'lms' && segments[2] === 'activities' && segments[3]) {
    ctx.activityId = segments[3]
  }
  // e.g. /dashboard/lms/learn/:lessonId/:activityId
  if (segments[0] === 'dashboard' && segments[1] === 'lms' && segments[2] === 'learn' && segments[3]) {
    ctx.lessonId = segments[3]
    if (segments[4]) ctx.activityId = segments[4]
  }
  // e.g. /dashboard/lms/:lessonId (not sub-pages)
  if (
    segments[0] === 'dashboard' &&
    segments[1] === 'lms' &&
    segments[2] &&
    !['questions', 'learn', 'activities', 'storage', 'today', 'new', 'attendance', 'my-lessons'].includes(segments[2])
  ) {
    ctx.lessonId = segments[2]
  }

  return ctx
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const returnUrl = encodeURIComponent(`/n/${id}`)
    return NextResponse.redirect(new URL(`/login?returnUrl=${returnUrl}`, request.url))
  }

  const admin = createAdminClient()

  // Query notification
  const { data: notification } = await (admin as any)
    .from('user_notifications')
    .select('id, school_id, recipient_id, type, category, url, student_id, read_at')
    .eq('id', id)
    .maybeSingle()

  // Privacy rule: Never reveal whether another user's ID exists.
  // Foreign IDs and non-existent IDs produce the exact same fallback response.
  if (!notification || notification.recipient_id !== user.id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Mark read if unread
  if (!notification.read_at) {
    await (admin as any)
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
  }

  // Determine recipient kind strictly from data
  const [{ data: guardianRow }, { data: studentRow }] = await Promise.all([
    admin
      .from('guardians')
      .select('id')
      .eq('profile_id', user.id)
      .eq('school_id', notification.school_id)
      .maybeSingle(),
    admin
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .eq('school_id', notification.school_id)
      .maybeSingle(),
  ])

  let recipientKind: RecipientKind = 'staff'
  if (guardianRow) {
    recipientKind = 'guardian'
  } else if (studentRow) {
    recipientKind = 'student'
  }

  // Extract stored IDs and parse URL segments for self-healing
  const urlContext = extractContextFromUrl(notification.url)
  const context: NotificationUrlContext = {
    ...urlContext,
    studentId: notification.student_id || urlContext.studentId || null,
  }

  // Compute destination using single-source-of-truth builder
  let destination = notificationUrl(notification.type, context, recipientKind)

  // Validate against allow-list and role-based access
  const isAllowed = isAllowedUrlForRecipient(destination, recipientKind)

  if (!isAllowed) {
    // Log privacy-safe warning with notification type only (NO personal data)
    console.warn(
      `[NotificationRedirect] Disallowed or invalid destination for notification type "${notification.type}" and recipientKind "${recipientKind}". Redirecting to /dashboard/notifications.`
    )
    destination = '/dashboard/notifications'
  }

  // Security check: NEVER redirect to external or protocol-relative URLs
  if (!destination.startsWith('/') || destination.startsWith('//')) {
    destination = '/dashboard/notifications'
  }

  return NextResponse.redirect(new URL(destination, request.url))
}
