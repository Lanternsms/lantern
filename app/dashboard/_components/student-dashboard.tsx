/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { Award, Calendar, CreditCard, Bell, FileText, CheckCircle2, PlayCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { LessonPlayerModal } from '../lms/lesson-player-modal'
import { NotesDownloadButton } from '../lms/notes-download-button'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

type EnrolmentData = {
  class_id: string
  arm_id: string | null
  enrolment_date: string | null
  classes: { name: string } | null
  arms: { name: string } | null
  academic_sessions: { name: string; is_current: boolean } | null
}

export type StudentDashboardProps = {
  student: {
    id: string
    school_id: string
    first_name: string
    last_name: string
    admission_no: string
    photo_url: string | null
    status: string
    date_of_birth: string | null
    gender: string | null
    enrolments?: EnrolmentData[]
  }
}

export async function StudentDashboard({ student }: StudentDashboardProps) {
  const currentEnrolment = student.enrolments?.find(
    (e) => e.academic_sessions?.is_current
  ) ?? student.enrolments?.[0]

  const className = currentEnrolment?.classes?.name ?? 'Not assigned'
  const armName = currentEnrolment?.arms?.name ?? null
  const classLabel = className + (armName ? ` · Arm ${armName}` : '')
  const sessionName = currentEnrolment?.academic_sessions?.name ?? 'Current Session'
  const initials = `${student.first_name[0] ?? ''}${student.last_name[0] ?? ''}`.toUpperCase()
  const isActive = student.status === 'active'

  // Fetch published lessons for this student's class
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

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      {/* Student Hero Profile Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Student Photo */}
          <div className="relative shrink-0">
            {student.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={student.photo_url}
                alt={`${student.first_name} ${student.last_name}`}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border-2 border-border shadow-sm ring-4 ring-primary/5"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-amber-100 text-amber-700 flex flex-col items-center justify-center font-bold text-2xl sm:text-3xl border-2 border-amber-200 ring-4 ring-amber-50">
                {initials}
                <span className="text-[10px] font-normal text-amber-600/80 mt-1">No photo</span>
              </div>
            )}
            <span
              className={`absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center ${
                isActive ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
              }`}
              title={isActive ? 'Active Student' : student.status}
            >
              <CheckCircle2 size={14} />
            </span>
          </div>

          {/* Student Info */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <p className="text-xs font-medium text-text-muted mb-0.5">{greeting}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
                {student.first_name} {student.last_name}
              </h1>
              <span
                className={`text-xs font-semibold rounded-full px-2.5 py-0.5 capitalize ${
                  isActive ? 'bg-success-bg text-success-text' : 'bg-danger-bg text-danger-text'
                }`}
              >
                {student.status}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1.5 text-xs sm:text-sm text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Admission No:</span>
                <strong className="text-text-primary font-semibold font-mono">{student.admission_no}</strong>
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Class:</span>
                <strong className="text-text-primary font-medium">{classLabel}</strong>
              </span>
              <span className="text-border hidden sm:inline">•</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-text-muted">Session:</span>
                <strong className="text-text-primary font-medium">{sessionName}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action Hub */}
      <div>
        <h2 className="text-base font-semibold text-text-primary mb-4">Your Portal Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card: My Results */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <Award size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Results</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Check published term grades, test scores, subject totals, class position, and full report cards.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/my-results"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Academic Results →
              </Link>
            </div>
          </div>

          {/* Card: My Timetable */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <Calendar size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Timetable</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Access your weekly class schedule, subject period times, and daily classroom routines.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/my-timetable"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Class Timetable →
              </Link>
            </div>
          </div>

          {/* Card: My Payments */}
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all hover:shadow-xs group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-white transition-colors">
                <CreditCard size={24} />
              </div>
              <h3 className="text-base font-semibold text-text-primary mb-1">My Payments</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Review fee payment history, term bills, settled invoices, and download transaction receipts.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <Link
                href="/dashboard/payments"
                className="text-xs font-semibold text-primary hover:text-primary-hover inline-flex items-center gap-1"
              >
                View Fee Payments →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recorded Lessons Library */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <PlayCircle size={18} className="text-primary" />
            Class Lessons
          </h2>
          <span className="text-xs text-text-secondary">
            {lessonsBySubject.reduce((acc, g) => acc + g.lessons.length, 0)} published
          </span>
        </div>

        {lessonsBySubject.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-text-secondary">
            No lessons have been published for your class yet.
          </div>
        ) : (
          <div className="space-y-4">
            {lessonsBySubject.map((group) => (
              <div key={group.subjectName} className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-muted">
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    {group.subjectName}
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {group.lessons.map((lesson: any) => (
                    <div
                      key={lesson.id}
                      className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {lesson.week_no != null && (
                            <span className="text-xs font-medium text-text-muted px-1.5 py-0.5 rounded bg-surface-muted border border-border">
                              Wk {lesson.week_no}
                            </span>
                          )}
                          <p className="text-sm font-medium text-text-primary truncate">{lesson.title}</p>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5 truncate">
                          {lesson.topic ? `${lesson.topic} · ` : ''}
                          {formatDuration(lesson.duration_seconds)}
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-2 flex-wrap justify-end">
                        <Link
                          href={`/dashboard/lms/learn/${lesson.id}?student=${student.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors min-h-[44px]"
                        >
                          Activities
                          {(activityCountByLesson.get(lesson.id) ?? 0) > 0 && (
                            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary/10 px-1 text-[10px] font-bold text-primary">
                              {activityCountByLesson.get(lesson.id)}
                            </span>
                          )}
                        </Link>
                        <LessonPlayerModal
                          lessonId={lesson.id}
                          title={lesson.title}
                          studentId={student.id}
                          notesName={lesson.notes_name}
                          notesSizeBytes={lesson.notes_size_bytes}
                          notesDownloadable={lesson.notes_downloadable}
                          label="Watch"
                        />
                        {lesson.notes_name && lesson.notes_downloadable && (
                          <NotesDownloadButton
                            lessonId={lesson.id}
                            notesSizeBytes={lesson.notes_size_bytes}
                            studentId={student.id}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* School Resources & Announcements */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/announcements"
          className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-muted text-text-secondary flex items-center justify-center shrink-0 group-hover:text-primary transition-colors">
              <Bell size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">School Announcements</p>
              <p className="text-xs text-text-muted mt-0.5">Stay updated on events, circulars, and notices</p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary">Browse →</span>
        </Link>

        <Link
          href="/dashboard/documents"
          className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-surface-muted text-text-secondary flex items-center justify-center shrink-0 group-hover:text-primary transition-colors">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">School Documents</p>
              <p className="text-xs text-text-muted mt-0.5">Forms, syllabus, and study materials</p>
            </div>
          </div>
          <span className="text-xs font-medium text-primary">Browse →</span>
        </Link>
      </div>
    </div>
  )
}
