/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MyLessonsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  const { data: lessons } = await (supabase as any)
    .from('lms_lessons')
    .select(`
      id, title, topic, week_no, status, created_at,
      classes:class_id ( name ),
      subjects:subject_id ( name ),
      activities:lms_activities ( id, kind, status )
    `)
    .eq('school_id', profile.school_id)
    .eq('recorded_by', user.id)
    .order('created_at', { ascending: false })

  const lessonList = lessons || []

  return (
    <div className="px-8 py-8 max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">My Recorded Lessons</h1>
          <p className="text-xs text-text-secondary mt-1">
            Lessons where you are designated as the recording teacher. Manage quizzes and assignments for each lesson.
          </p>
        </div>
      </div>

      {lessonList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-surface">
          <p className="text-sm font-medium text-text-primary">No recorded lessons yet</p>
          <p className="text-xs text-text-secondary mt-1">
            When lessons are uploaded and assigned to you as the recording teacher, they will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-muted/50 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Lesson Title</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Week</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Activities</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lessonList.map((lesson: any) => {
                  const actList = lesson.activities || []
                  const pubCount = actList.filter((a: any) => a.status === 'published').length

                  return (
                    <tr key={lesson.id} className="hover:bg-surface-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/lms/${lesson.id}`}
                          className="font-medium text-text-primary hover:text-primary transition-colors"
                        >
                          {lesson.title}
                        </Link>
                        {lesson.topic && (
                          <div className="text-xs text-text-secondary truncate max-w-xs">
                            {lesson.topic}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {lesson.classes?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {lesson.subjects?.name || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {lesson.week_no ? `Wk ${lesson.week_no}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            lesson.status === 'published'
                              ? 'bg-success-bg text-success-text'
                              : 'bg-surface-muted text-text-secondary border border-border'
                          }`}
                        >
                          {lesson.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary">
                        {actList.length > 0 ? (
                          <span>
                            {actList.length} total ({pubCount} published)
                          </span>
                        ) : (
                          <span className="text-text-secondary/60">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/dashboard/lms/${lesson.id}`}
                          className="inline-flex items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors"
                        >
                          Manage Activities &rarr;
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
