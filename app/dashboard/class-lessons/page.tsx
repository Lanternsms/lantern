/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PlayCircle, BookOpen } from 'lucide-react'
import { LessonPlayerModal } from '../lms/lesson-player-modal'
import { NotesDownloadButton } from '../lms/notes-download-button'
import GuardianAskButton from '../_components/guardian-ask-button'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Class Lessons | Lantern',
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default async function ClassLessonsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: studentRow } = await supabase
    .from('students')
    .select(`
      id, school_id, first_name, last_name, admission_no,
      enrolments (
        class_id, arm_id,
        classes ( name ),
        arms ( name ),
        academic_sessions ( name, is_current )
      )
    `)
    .eq('profile_id', user.id)
    .maybeSingle()

  if (!studentRow) {
    return (
      <div className="px-8 py-8 max-w-4xl">
        <p className="text-sm text-text-secondary">
          No student profile is linked to your account. If you believe this is an error, please contact your school administrator.
        </p>
      </div>
    )
  }

  const currentEnrolment =
    studentRow.enrolments?.find((e: any) => e.academic_sessions?.is_current) ||
    studentRow.enrolments?.[0]

  const classLabel = currentEnrolment?.classes?.name
    ? currentEnrolment.arms?.name
      ? `${currentEnrolment.classes.name} - ${currentEnrolment.arms.name}`
      : currentEnrolment.classes.name
    : 'Your Class'

  let lessonsBySubject: { subjectName: string; lessons: any[] }[] = []
  const activityCountByLesson = new Map<string, number>()

  if (currentEnrolment?.class_id) {
    const admin = createAdminClient()
    const { data: rawLessons } = await (admin as any)
      .from('lms_lessons')
      .select(`
        id, title, topic, week_no, duration_seconds, created_at,
        notes_name, notes_size_bytes, notes_downloadable,
        subjects:subject_id ( name )
      `)
      .eq('class_id', currentEnrolment.class_id)
      .eq('status', 'published')
      .not('video_path', 'is', null)
      .order('week_no', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })

    const groups = new Map<string, any[]>()
    for (const l of rawLessons ?? []) {
      const subName = (l.subjects as any)?.name ?? 'General'
      if (!groups.has(subName)) groups.set(subName, [])
      groups.get(subName)!.push(l)
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b))
    lessonsBySubject = sortedKeys.map((k) => ({
      subjectName: k,
      lessons: groups.get(k)!,
    }))

    const lessonIds = (rawLessons ?? []).map((l: any) => l.id)
    if (lessonIds.length > 0) {
      const { data: actRows } = await (admin as any)
        .from('lms_activities')
        .select('lesson_id')
        .in('lesson_id', lessonIds)
        .eq('status', 'published')

      for (const a of (actRows ?? [])) {
        activityCountByLesson.set(a.lesson_id, (activityCountByLesson.get(a.lesson_id) ?? 0) + 1)
      }
    }
  }

  const totalLessons = lessonsBySubject.reduce((acc, g) => acc + g.lessons.length, 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-sm text-text-secondary mb-1">
          <Link href="/dashboard" className="hover:text-primary transition-colors">Dashboard</Link> / Class Lessons
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
              <PlayCircle className="text-primary w-7 h-7" />
              Class Lessons
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Recorded lessons and self-paced activities for <strong className="text-text-primary">{classLabel}</strong>
            </p>
          </div>

          <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary self-start sm:self-auto">
            {totalLessons} Lesson{totalLessons === 1 ? '' : 's'} Published
          </span>
        </div>
      </div>

      {/* Content */}
      {lessonsBySubject.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-secondary">
            <BookOpen className="w-6 h-6" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">No lessons published yet</h2>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            Lessons for {classLabel} will appear here once your teachers upload and publish them.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {lessonsBySubject.map((group) => (
            <div key={group.subjectName} className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border bg-surface-muted flex items-center justify-between">
                <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  {group.subjectName}
                </h2>
                <span className="text-xs text-text-secondary font-medium">
                  {group.lessons.length} lesson{group.lessons.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="divide-y divide-border">
                {group.lessons.map((lesson: any) => {
                  const actCount = activityCountByLesson.get(lesson.id) ?? 0

                  return (
                    <div
                      key={lesson.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted/40 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {lesson.week_no != null && (
                            <span className="text-xs font-semibold text-text-secondary px-2 py-0.5 rounded-md bg-surface-muted border border-border">
                              Week {lesson.week_no}
                            </span>
                          )}
                          <h3 className="text-sm font-semibold text-text-primary">{lesson.title}</h3>
                        </div>

                        <p className="text-xs text-text-secondary">
                          {lesson.topic ? `${lesson.topic} · ` : ''}
                          Duration: {formatDuration(lesson.duration_seconds)}
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
                        <Link
                          href={`/dashboard/lms/learn/${lesson.id}?student=${studentRow.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors min-h-[44px]"
                        >
                          Activities
                          {actCount > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                              {actCount}
                            </span>
                          )}
                        </Link>

                        <LessonPlayerModal
                          lessonId={lesson.id}
                          title={lesson.title}
                          studentId={studentRow.id}
                          notesName={lesson.notes_name}
                          notesSizeBytes={lesson.notes_size_bytes}
                          notesDownloadable={lesson.notes_downloadable}
                          label="Watch"
                        />

                        {lesson.notes_name && lesson.notes_downloadable && (
                          <NotesDownloadButton
                            lessonId={lesson.id}
                            notesSizeBytes={lesson.notes_size_bytes}
                            studentId={studentRow.id}
                          />
                        )}

                        <GuardianAskButton
                          lessonId={lesson.id}
                          title={lesson.title}
                          studentId={studentRow.id}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
