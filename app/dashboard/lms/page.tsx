/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLmsAccess } from '@/lib/lms/access'
import { Add01Icon, PlayIcon, SparklesIcon } from '@hugeicons/core-free-icons'
import { Icon } from '@/components/icon'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default async function LmsPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; subject?: string; error?: string }>
}) {
  const params = await searchParams
  const classFilter = params.class ?? ''
  const subjectFilter = params.subject ?? ''
  const errorMsg = params.error ?? ''

  const access = await getLmsAccess()
  if (!access.isManager) {
    notFound()
  }
  const { supabase } = access

  // Sidebar data
  const { data: classes } = await supabase.from('classes').select('id, name').order('name')
  const { data: subjects } = await supabase.from('subjects').select('id, name').order('name')

  // Build lesson query — RLS scopes to the user's school automatically
  let query = (supabase as any)
    .from('lms_lessons')
    .select(`
      id, title, topic, week_no, status, duration_seconds, created_at,
      class_id, subject_id,
      classes:class_id ( name ),
      subjects:subject_id ( name ),
      recorder:recorded_by ( first_name, last_name )
    `)
    .order('week_no', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (classFilter) query = query.eq('class_id', classFilter)
  if (subjectFilter) query = query.eq('subject_id', subjectFilter)

  const { data: lessons } = await query

  // Group: Class → Subject → lessons[]
  type Lesson = {
    id: string; title: string; topic: string | null; week_no: number | null
    status: string; duration_seconds: number | null; created_at: string
    class_id: string; subject_id: string
    classes: { name: string } | null
    subjects: { name: string } | null
    recorder: { first_name: string; last_name: string } | null
  }
  const grouped = new Map<string, Map<string, Lesson[]>>()

  for (const l of (lessons ?? []) as Lesson[]) {
    const className = l.classes?.name ?? 'Unknown Class'
    const subjectName = l.subjects?.name ?? 'Unknown Subject'
    if (!grouped.has(className)) grouped.set(className, new Map())
    const classMap = grouped.get(className)!
    if (!classMap.has(subjectName)) classMap.set(subjectName, [])
    classMap.get(subjectName)!.push(l)
  }

  const all = (lessons ?? []) as Lesson[]
  const published = all.filter((l) => l.status === 'published').length
  const field = 'h-10 rounded-xl border border-control bg-surface px-3 text-sm focus:border-primary focus:outline-none focus:ring-4 focus:ring-school-soft'

  return (
    <div className="flex flex-col gap-6 px-5 pb-12 pt-7 sm:px-8 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-tight sm:text-[36px]">Lessons</h1>
          <p className="text-[15px] text-text-secondary">{all.length} lesson{all.length === 1 ? '' : 's'} · {published} published to students</p>
        </div>
        {access.isManager && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/lms/ai" className="flex h-10 items-center gap-2 rounded-xl bg-surface px-4 text-sm font-medium shadow-card ring-1 ring-black/[0.06] hover:bg-raised">
              <Icon icon={SparklesIcon} size={17} className="text-school" /> LUMI tutor settings
            </Link>
            <Link href="/dashboard/lms/new" className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover">
              <Icon icon={Add01Icon} size={17} /> New lesson
            </Link>
          </div>
        )}
      </div>

      {errorMsg && <p role="alert" className="rounded-xl bg-danger-bg px-4 py-3 text-sm text-danger-text">{errorMsg}</p>}

      <form className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="f-class">Class</label>
        <select id="f-class" name="class" defaultValue={classFilter} className={field}>
          <option value="">All classes</option>
          {(classes ?? []).map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="f-subject">Subject</label>
        <select id="f-subject" name="subject" defaultValue={subjectFilter} className={field}>
          <option value="">All subjects</option>
          {(subjects ?? []).map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="submit" className="h-10 rounded-xl bg-raised px-4 text-sm font-medium hover:bg-school-soft hover:text-school-ink">Filter</button>
        {(classFilter || subjectFilter) && <Link href="/dashboard/lms" className="px-2 text-sm text-text-secondary hover:text-text-primary">Clear</Link>}
      </form>

      {grouped.size === 0 ? (
        <div className="card flex flex-col items-start gap-2 p-8">
          <span className="font-display text-lg font-semibold">{classFilter || subjectFilter ? 'No lessons match these filters' : 'No lessons yet'}</span>
          <span className="max-w-[52ch] text-text-secondary">Record a lesson on a phone or upload a video, then attach the notes so LUMI can answer students’ questions from them.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Array.from(grouped.entries()).map(([className, subjectMap]) => (
            <section key={className} aria-labelledby={`c-${className}`} className="flex flex-col gap-3">
              <h2 id={`c-${className}`} className="text-lg font-semibold">{className}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {Array.from(subjectMap.entries()).map(([subjectName, items]) => (
                  <div key={subjectName} className="card overflow-hidden">
                    <div className="flex items-center justify-between px-5 pb-2 pt-4">
                      <h3 className="font-semibold">{subjectName}</h3>
                      <span className="text-xs text-text-secondary">{items.length} lesson{items.length === 1 ? '' : 's'}</span>
                    </div>
                    <ul>
                      {items.map((lesson) => (
                        <li key={lesson.id}>
                          <Link href={`/dashboard/lms/${lesson.id}`} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-school-soft/40">
                            <span className="relative flex h-14 w-24 shrink-0 items-end justify-end overflow-hidden rounded-xl bg-school-deep p-1.5">
                              <Icon icon={PlayIcon} size={18} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/85" />
                              <span className="rounded bg-black/40 px-1 text-[11px] font-semibold tabular-nums text-white">{formatDuration(lesson.duration_seconds)}</span>
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate font-medium">{lesson.title}</span>
                              <span className="truncate text-xs text-text-secondary">
                                {lesson.week_no != null ? `Week ${lesson.week_no} · ` : ''}{lesson.topic ? `${lesson.topic} · ` : ''}{lesson.recorder ? `${lesson.recorder.first_name} ${lesson.recorder.last_name}` : '—'}
                              </span>
                            </span>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${lesson.status === 'published' ? 'bg-success-bg text-success-text' : 'bg-raised text-[#374151]'}`}>
                              {lesson.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
