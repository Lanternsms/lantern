/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { Award, Calendar, CreditCard, Bell, FileText, CheckCircle2, PlayCircle } from '@/components/icons'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTodayInLagos } from '../lms/lagos-time'
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

  // ---- Today's timetable for this student's class arm ----
  const { dayOfWeek } = getTodayInLagos()
  const nowHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  type Slot = { id: string; time: string; subject: string; teacher: string; state: 'past' | 'now' | 'next' | 'later' }
  let today: Slot[] = []
  if (currentEnrolment?.class_id) {
    const supabase = await createClient()
    const { data: session } = await supabase.from('academic_sessions').select('id').eq('school_id', student.school_id).eq('is_current', true).maybeSingle()
    if (session) {
      const [{ data: periods }, { data: entries }] = await Promise.all([
        (supabase as any).from('timetable_periods').select('id, name, start_time, end_time, is_break').order('sort_order'),
        (() => {
          let q = (supabase as any).from('timetable_entries').select('period_id, subjects(name), teacher:profiles(first_name, last_name)')
            .eq('session_id', session.id).eq('class_id', currentEnrolment.class_id).eq('day_of_week', dayOfWeek)
          q = currentEnrolment.arm_id ? q.eq('arm_id', currentEnrolment.arm_id) : q.is('arm_id', null)
          return q
        })(),
      ])
      const byPeriod = new Map((entries ?? []).map((e: any) => [e.period_id, e]))
      let nextGiven = false
      today = (periods ?? []).filter((p: any) => !p.is_break && byPeriod.has(p.id)).map((p: any) => {
        const e: any = byPeriod.get(p.id)
        const start = String(p.start_time).slice(0, 5), end = String(p.end_time).slice(0, 5)
        let state: Slot['state'] = nowHm >= end ? 'past' : nowHm >= start ? 'now' : 'later'
        if (state === 'later' && !nextGiven) { state = 'next'; nextGiven = true }
        return { id: p.id, time: start, subject: e.subjects?.name ?? p.name, teacher: e.teacher ? `${e.teacher.first_name ?? ''} ${e.teacher.last_name ?? ''}`.trim() : '', state }
      })
    }
  }
  const nextSlot = today.find((t) => t.state === 'next')
  const lessonTotal = lessonsBySubject.reduce((n, g) => n + g.lessons.length, 0)

  const hour = Number(nowHm.slice(0, 2))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-7 px-5 pb-12 pt-7 sm:px-6 sm:pt-9">
      <section aria-labelledby="hello" className="flex flex-col gap-6 rounded-[24px] bg-school-deep p-6 text-white shadow-raise sm:p-8">
        <div className="flex items-start gap-4">
          {student.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={student.photo_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-white/30" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-lg font-semibold text-school-deep">{initials}</span>
          )}
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 id="hello" className="text-[32px] font-semibold leading-[1.05] sm:text-[44px]">
              {greeting.replace('Good ', '').replace(/^./, (c) => c.toUpperCase())}, {student.first_name}.
            </h1>
            <p className="text-base text-school-deep-muted sm:text-lg">
              {nextSlot ? `${nextSlot.subject} is next, at ${nextSlot.time}.` : today.length ? 'That’s all your classes for today.' : `${classLabel} · ${sessionName}`}
              {lessonTotal > 0 && ` ${lessonTotal} recorded lesson${lessonTotal === 1 ? '' : 's'} for your class.`}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Today</span>
            <Link href="/dashboard/my-timetable" className="text-school-deep-muted underline-offset-4 hover:text-white hover:underline">Full timetable</Link>
          </div>
          {today.length === 0 ? (
            <p className="text-school-deep-muted">No classes on your timetable today.</p>
          ) : (
            <ol className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2">
              {today.map((t) => (
                <li
                  key={t.id}
                  aria-current={t.state === 'now' ? 'time' : undefined}
                  className={`flex min-h-[64px] flex-col gap-0.5 rounded-xl px-3 py-2.5 ${
                    t.state === 'now' ? 'bg-white text-school-deep'
                    : t.state === 'next' ? 'bg-white/20 text-white'
                    : t.state === 'past' ? 'bg-white/[0.06] text-white/55'
                    : 'border border-white/20 text-white/85'
                  }`}
                >
                  <span className="text-xs tabular-nums opacity-80">{t.state === 'now' ? `Now · ${t.time}` : t.time}</span>
                  <span className="font-semibold leading-tight">{t.subject}</span>
                  {t.teacher && <span className="truncate text-xs opacity-75">{t.teacher}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {!isActive && (
        <p role="status" className="rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-text">
          Your account is marked “{student.status}”. Ask the school office if this is a mistake.
        </p>
      )}

      <nav aria-label="Your pages" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[
          { href: '/dashboard/my-results', label: 'Results', note: 'Term scores and report cards', Icon: Award },
          { href: '/dashboard/my-timetable', label: 'Timetable', note: 'Your week, period by period', Icon: Calendar },
          { href: '/dashboard/payments', label: 'Fees', note: 'Bills, payments and receipts', Icon: CreditCard },
        ].map(({ href, label, note, Icon }) => (
          <Link key={href} href={href} className="card flex items-center gap-3 px-4 py-4 transition-transform hover:-translate-y-px">
            <Icon aria-hidden size={18} strokeWidth={1.6} className="shrink-0 text-text-secondary" />
            <span className="flex min-w-0 flex-col"><span className="font-semibold">{label}</span><span className="truncate text-sm text-text-secondary">{note}</span></span>
          </Link>
        ))}
      </nav>

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
          <div className="card p-8 text-center text-sm text-text-secondary">
            No lessons have been published for your class yet.
          </div>
        ) : (
          <div className="space-y-4">
            {lessonsBySubject.map((group) => (
              <div key={group.subjectName} className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border bg-surface-muted">
                  <h3 className="text-xs font-semibold text-text-secondary ">
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
                          className="card inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-muted transition-colors min-h-[44px]"
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
          className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center shrink-0 text-text-secondary">
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
          className="bg-surface border border-border rounded-lg p-5 flex items-center justify-between hover:border-primary/50 transition-colors group"
        >
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center shrink-0 text-text-secondary">
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
