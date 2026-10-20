/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAskerAccess } from '@/app/dashboard/lms/access'
import { getSubmission } from '@/app/dashboard/lms/activities/actions'
import { createAdminClient } from '@/lib/supabase/admin'
import { QuizPlayerClient } from './quiz-player-client'
import { AssignmentSubmitClient } from './assignment-submit-client'

export const dynamic = 'force-dynamic'

export default async function LearnerActivityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string; activityId: string }>
  searchParams: Promise<{ student?: string }>
}) {
  const { lessonId, activityId } = await params
  const { student: studentQuery } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, school_id')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  let studentId = studentQuery

  if (!studentId) {
    const { data: st } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (st) {
      studentId = st.id
    } else {
      const { data: links } = await (supabase as any)
        .from('guardian_students')
        .select('student_id')
        .eq('guardian_id', user.id)
        .limit(1)

      if (links && links.length > 0) {
        studentId = links[0].student_id
      }
    }
  }

  if (!studentId) {
    redirect('/dashboard?error=' + encodeURIComponent('No student profile found.'))
  }

  // Authorize
  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) {
    redirect('/dashboard?error=' + encodeURIComponent('Access denied to this lesson activity.'))
  }

  // Load activity
  const admin = createAdminClient()
  const { data: activity } = await (admin as any)
    .from('lms_activities')
    .select('*')
    .eq('id', activityId)
    .eq('lesson_id', lessonId)
    .eq('school_id', profile.school_id)
    .eq('status', 'published')
    .maybeSingle()

  if (!activity) notFound()

  // Fetch student profile name
  const { data: studentRow } = await supabase
    .from('students')
    .select('id, profile:profiles(first_name, last_name)')
    .eq('id', studentId)
    .single()

  const studentName = (studentRow as any)?.profile
    ? `${(studentRow as any).profile.first_name} ${(studentRow as any).profile.last_name}`
    : 'Student'

  let submission: any = null
  if (activity.kind === 'assignment') {
    const { data: existingSub } = await (admin as any)
      .from('lms_submissions')
      .select('id')
      .eq('activity_id', activityId)
      .eq('student_id', studentId)
      .maybeSingle()

    if (existingSub) {
      submission = await getSubmission(existingSub.id)
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <Link
          href={`/dashboard/lms/learn/${lessonId}?student=${studentId}`}
          className="hover:text-primary transition-colors"
        >
          &larr; Back to {access.lesson?.title || 'Lesson Activities'}
        </Link>
        <span className="font-medium text-text-primary">
          Student: {studentName}
        </span>
      </div>

      {activity.kind === 'quiz' ? (
        <QuizPlayerClient
          activityId={activityId}
          studentId={studentId}
          lessonId={lessonId}
          studentName={studentName}
        />
      ) : (
        <AssignmentSubmitClient
          activity={activity}
          submission={submission}
          studentId={studentId}
          lessonId={lessonId}
          studentName={studentName}
        />
      )}
    </div>
  )
}
