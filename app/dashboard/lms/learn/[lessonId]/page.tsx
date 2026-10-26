/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getAskerAccess } from '@/app/dashboard/lms/access'
import { listActivitiesForLearner } from '@/app/dashboard/lms/activities/actions'
import { LessonPlayerModal } from '@/app/dashboard/lms/lesson-player-modal'
import { LessonAiPanel } from '@/app/dashboard/lms/lesson-ai-panel'
import GuardianAskButton from '@/app/dashboard/_components/guardian-ask-button'

export const dynamic = 'force-dynamic'

export default async function LearnerLessonActivitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lessonId: string }>
  searchParams: Promise<{ student?: string }>
}) {
  const { lessonId } = await params
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

  // If studentId wasn't passed in query, try to resolve it from the user
  if (!studentId) {
    // Check if the current user is a student
    const { data: st } = await supabase
      .from('students')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (st) {
      studentId = st.id
    } else {
      // Check if user is a guardian with linked students
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
    redirect('/dashboard?error=' + encodeURIComponent('No student profile found for activity view.'))
  }

  // Verify access for this student and lesson
  const access = await getAskerAccess(user.id, lessonId, studentId)
  if (!access) {
    redirect('/dashboard?error=' + encodeURIComponent('You do not have access to activities for this lesson.'))
  }

  const result = await listActivitiesForLearner(lessonId, studentId)
  if (!result || result.error) {
    redirect('/dashboard?error=' + encodeURIComponent(result?.error || 'Failed to load activities.'))
  }

  const { activities, lesson } = result

  // Fetch student name
  const { data: studentRow } = await supabase
    .from('students')
    .select('id, profile:profiles(first_name, last_name)')
    .eq('id', studentId)
    .single()

  const studentName = (studentRow as any)?.profile
    ? `${(studentRow as any).profile.first_name} ${(studentRow as any).profile.last_name}`
    : 'Student'

  const admin = createAdminClient()
  const { data: notesText } = await (admin as any)
    .from('lms_lesson_notes_text')
    .select('status')
    .eq('lesson_id', lessonId)
    .eq('school_id', profile.school_id)
    .maybeSingle()
  const notesReady = notesText?.status === 'ready'

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      {/* Top breadcrumb & lesson info */}
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            &larr; Back to Dashboard
          </Link>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Student: {studentName}
          </span>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-border pt-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">{lesson.title}</h1>
            <p className="text-xs text-text-secondary mt-1">
              Class: <strong className="text-text-primary">{lesson.classes?.name || 'Class'}</strong> &bull;
              {' '}Subject: <strong className="text-text-primary">{lesson.subjects?.name || 'Subject'}</strong>
              {lesson.topic && <> &bull; Topic: {lesson.topic}</>}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {lesson.video_path && (
              <LessonPlayerModal
                lessonId={lesson.id}
                title={lesson.title}
                studentId={studentId}
                label="Watch Video"
              />
            )}
            <LessonAiPanel
              lessonId={lesson.id}
              lessonTitle={lesson.title}
              studentId={studentId}
              mode="student"
              aiTutorEnabled={lesson.ai_tutor_enabled ?? true}
              notesReady={notesReady}
            />
            <GuardianAskButton
              lessonId={lesson.id}
              title={lesson.title}
              studentId={studentId}
            />
          </div>
        </div>
      </div>

      {/* Activities List */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Lesson Activities</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Quizzes and assignments prepared for this lesson.
          </p>
        </div>

        {activities.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
            <p className="text-sm font-medium text-text-primary">No activities for this lesson yet</p>
            <p className="text-xs text-text-secondary mt-1">
              Check back later when your teacher publishes a quiz or assignment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {activities.map((act: any) => {
              const isQuiz = act.kind === 'quiz'
              const attemptsCount = act.attemptsCount || 0
              const maxAttempts = act.attempts_allowed || 1
              const attemptsLeft = Math.max(0, maxAttempts - attemptsCount)
              const hasInProgress = !!act.hasInProgress
              const latestSub = act.latestSubmission

              let statusChip = (
                <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                  Not Started
                </span>
              )

              let actionButtonLabel = isQuiz ? 'Start Quiz' : 'Open Assignment'
              let canAttempt = true

              if (isQuiz) {
                if (hasInProgress) {
                  statusChip = (
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                      In Progress
                    </span>
                  )
                  actionButtonLabel = 'Resume Quiz'
                } else if (attemptsCount > 0) {
                  statusChip = (
                    <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success-text">
                      Score: {act.bestScore} / {act.max_score}
                    </span>
                  )
                  if (attemptsLeft > 0) {
                    actionButtonLabel = `Retake Quiz (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left)`
                  } else {
                    actionButtonLabel = 'View Results'
                    canAttempt = false
                  }
                }
              } else {
                if (latestSub?.status === 'marked') {
                  statusChip = (
                    <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-medium text-success-text">
                      Marked: {latestSub.score} / {act.max_score}
                    </span>
                  )
                  actionButtonLabel = 'View Feedback'
                } else if (latestSub?.status === 'submitted') {
                  statusChip = (
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                      Submitted (Awaiting Marking)
                    </span>
                  )
                  actionButtonLabel = 'Edit / Review Submission'
                }
              }

              return (
                <div
                  key={act.id}
                  className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                            isQuiz
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          }`}
                        >
                          {act.kind}
                        </span>
                        <h3 className="text-base font-semibold text-text-primary">{act.title}</h3>
                        {statusChip}
                        {act.hasBrief && (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400"
                            title={act.briefName || 'Assignment Document PDF'}
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            PDF Brief
                          </span>
                        )}
                      </div>

                      {act.instructions && (
                        <p className="text-xs text-text-secondary line-clamp-2 pt-1">
                          {act.instructions}
                        </p>
                      )}
                    </div>

                    <Link
                      href={`/dashboard/lms/learn/${lessonId}/${act.id}?student=${studentId}`}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 transition-colors shrink-0"
                    >
                      {actionButtonLabel} &rarr;
                    </Link>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-secondary border-t border-border pt-3">
                    <span>
                      Points: <strong className="text-text-primary">{act.max_score} marks</strong>
                    </span>
                    {act.due_at && (
                      <span>
                        Due:{' '}
                        <strong className="text-text-primary">
                          {new Date(act.due_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </strong>
                      </span>
                    )}
                    {isQuiz && act.time_limit_minutes && (
                      <span>
                        Time Limit: <strong className="text-text-primary">{act.time_limit_minutes} mins</strong>
                      </span>
                    )}
                    {isQuiz && (
                      <span>
                        Attempts: <strong className="text-text-primary">{attemptsCount} / {maxAttempts}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
