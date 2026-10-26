/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getLmsAccess } from '@/lib/lms/access'

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold text-text-primary">Lessons</h1>
        {access.isManager && (
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/lms/ai"
              className="border border-primary/20 bg-primary/5 text-primary text-sm font-medium rounded-lg px-3.5 py-2 hover:bg-primary/10 transition-colors inline-flex items-center gap-1.5"
            >
              <span>✨ Lumi AI Tutor</span>
            </Link>
            <Link
              href="/dashboard/lms/new"
              className="bg-primary text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-primary-hover transition-colors"
            >
              + New Lesson
            </Link>
          </div>
        )}
      </div>

      {errorMsg && (
        <p className="text-sm text-danger-text bg-danger-bg border border-red-200 rounded-lg px-3 py-2">
          {errorMsg}
        </p>
      )}

      {/* Filters */}
      <form className="flex gap-3 flex-wrap">
        <select
          name="class"
          defaultValue={classFilter}
          onChange={undefined}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All classes</option>
          {(classes ?? []).map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          name="subject"
          defaultValue={subjectFilter}
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All subjects</option>
          {(subjects ?? []).map((s: { id: string; name: string }) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-border px-3 py-2 text-sm text-text-primary bg-surface hover:bg-surface-muted transition-colors"
        >
          Filter
        </button>
        {(classFilter || subjectFilter) && (
          <Link
            href="/dashboard/lms"
            className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-primary transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Grouped lesson list */}
      {grouped.size === 0 ? (
        <p className="text-sm text-text-secondary">No lessons found.</p>
      ) : (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([className, subjectMap]) => (
            <div key={className}>
              <h2 className="text-sm font-semibold text-text-primary mb-3">{className}</h2>
              <div className="space-y-6">
                {Array.from(subjectMap.entries()).map(([subjectName, items]) => (
                  <div key={subjectName} className="bg-surface border border-border rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border bg-surface-muted">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                        {subjectName}
                      </h3>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((lesson) => (
                        <Link
                          key={lesson.id}
                          href={`/dashboard/lms/${lesson.id}`}
                          className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-text-primary truncate">{lesson.title}</p>
                            <p className="text-xs text-text-secondary mt-0.5 truncate">
                              {lesson.topic && <span>{lesson.topic} · </span>}
                              {lesson.recorder
                                ? `${lesson.recorder.first_name} ${lesson.recorder.last_name}`
                                : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {lesson.week_no != null && (
                              <span className="text-xs text-text-muted">Wk {lesson.week_no}</span>
                            )}
                            <span className="text-xs text-text-muted">{formatDuration(lesson.duration_seconds)}</span>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              lesson.status === 'published'
                                ? 'bg-success-bg text-success-text'
                                : 'bg-surface-muted text-text-secondary border border-border'
                            }`}>
                              {lesson.status}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
