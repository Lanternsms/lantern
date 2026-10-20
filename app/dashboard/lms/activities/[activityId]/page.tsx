/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getActivity, listSubmissions } from '../actions'
import { ActivityRosterClient } from './activity-roster-client'

export const dynamic = 'force-dynamic'

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ activityId: string }>
}) {
  const { activityId } = await params

  const actData = await getActivity(activityId)
  if (!actData || !actData.activity) notFound()

  if (!actData.canView && !actData.canManage) {
    redirect('/dashboard/lms?error=' + encodeURIComponent('Access denied to this activity.'))
  }

  const submissionsData = await listSubmissions(activityId)
  if (!submissionsData || submissionsData.error) {
    redirect('/dashboard/lms?error=' + encodeURIComponent(submissionsData?.error || 'Failed to load submissions.'))
  }

  const { activity, session, roster, totalEnrolled, submittedCount } = submissionsData
  const lesson = activity.lesson

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <p className="text-sm text-text-secondary mb-1">
          <Link href="/dashboard/lms" className="hover:text-primary">Lessons</Link>
          {' '}/ <Link href={`/dashboard/lms/${activity.lesson_id}`} className="hover:text-primary">{lesson?.title || 'Lesson'}</Link>
          {' '}/ {activity.title}
        </p>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  activity.kind === 'quiz'
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                }`}
              >
                {activity.kind}
              </span>
              <h1 className="text-xl font-semibold text-text-primary">{activity.title}</h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  activity.status === 'published'
                    ? 'bg-success-bg text-success-text'
                    : 'bg-surface-muted text-text-secondary border border-border'
                }`}
              >
                {activity.status}
              </span>
            </div>

            <p className="text-xs text-text-secondary mt-1">
              Class: <strong className="text-text-primary">{lesson?.class?.name || 'Class'}</strong> &bull;
              {' '}Subject: <strong className="text-text-primary">{lesson?.subject?.name || 'Subject'}</strong>
              {activity.due_at && (
                <>
                  {' '}&bull; Due: {new Date(activity.due_at).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </>
              )}
            </p>
          </div>

          <Link
            href={`/dashboard/lms/${activity.lesson_id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
          >
            &larr; Back to Lesson
          </Link>
        </div>

        {activity.instructions && (
          <div className="mt-3 rounded-lg border border-border bg-surface-muted/40 p-3 text-xs text-text-secondary">
            {activity.instructions}
          </div>
        )}
      </div>

      <ActivityRosterClient
        activity={activity}
        session={session}
        roster={roster || []}
        totalEnrolled={totalEnrolled || 0}
        submittedCount={submittedCount || 0}
        canManage={actData.canManage}
        canViewResults={actData.canView}
        questions={actData.questions || []}
      />
    </div>
  )
}
