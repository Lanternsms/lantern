/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getLmsAccess } from '@/lib/lms/access'
import { formatFileSize, formatCodecLabel, type VideoCodec } from '../video-inspect'
import { OrphansTable, type OrphanObject } from './orphans-table'

export const dynamic = 'force-dynamic'

export default async function LmsStoragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const access = await getLmsAccess(supabase, user)
  if (!access.isManager) {
    notFound()
  }

  // 1. Fetch usage data from user RPC
  const { data: rawUsage } = await (supabase as any).rpc('lms_storage_usage')
  const usageRows = Array.isArray(rawUsage) ? rawUsage : []

  let lessonCount = 0
  let lessonBytes = 0
  let assignmentCount = 0
  let assignmentBytes = 0

  for (const row of usageRows) {
    const bucket = row.bucket_id
    const objs = Number(row.objects) || 0
    const bytes = Number(row.bytes) || 0

    if (bucket === 'lms-lessons') {
      lessonCount += objs
      lessonBytes += bytes
    } else {
      assignmentCount += objs
      assignmentBytes += bytes
    }
  }

  const totalCount = lessonCount + assignmentCount
  const totalBytes = lessonBytes + assignmentBytes

interface LargestLessonItem {
  id: string
  title: string
  className: string
  subjectName: string
  sizeBytes: number | null
  codec: string | null
}

  // 2. Fetch top 15 largest lessons
  const { data: largestLessonsRaw } = await (supabase as any)
    .from('lms_lessons')
    .select(`
      id,
      title,
      video_size_bytes,
      video_codec,
      class:classes(name),
      subject:subjects(name)
    `)
    .eq('school_id', access.schoolId)
    .not('video_path', 'is', null)
    .order('video_size_bytes', { ascending: false, nullsFirst: false })
    .limit(15)

  const largestLessons: LargestLessonItem[] = (largestLessonsRaw ?? []).map((l: any) => ({
    id: l.id,
    title: l.title,
    className: l.class?.name ?? '—',
    subjectName: l.subject?.name ?? '—',
    sizeBytes: typeof l.video_size_bytes === 'number' ? l.video_size_bytes : null,
    codec: l.video_codec ?? null,
  }))

  // 3. Fetch orphans from user RPC
  const { data: rawOrphans } = await (supabase as any).rpc('lms_orphan_objects')
  const baseOrphans: OrphanObject[] = Array.isArray(rawOrphans)
    ? rawOrphans.map((o: { bucket_id?: string; name?: string; bytes?: number; created_at?: string }) => ({
        bucket_id: o.bucket_id ?? 'unknown',
        name: o.name ?? '',
        bytes: Number(o.bytes) || 0,
        created_at: o.created_at ?? new Date().toISOString(),
      }))
    : []

  // Add lms-notes orphan detection (bucket has no RLS policies, so use admin client)
  const admin = createAdminClient()
  const { data: notesObjects } = await admin.storage
    .from('lms-notes')
    .list(access.schoolId, { limit: 1000 })

  const { data: referencedNotes } = await (admin as any)
    .from('lms_lessons')
    .select('notes_path')
    .eq('school_id', access.schoolId)
    .not('notes_path', 'is', null)

  const referencedPaths = new Set(
    (referencedNotes ?? []).map((r: any) => r.notes_path as string)
  )

  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const notesOrphans: OrphanObject[] = (notesObjects ?? [])
    .filter((obj) => {
      if (!obj.name || obj.name === '.emptyFolderPlaceholder') return false
      const fullPath = `${access.schoolId}/${obj.name}`
      if (referencedPaths.has(fullPath)) return false
      if (obj.created_at && new Date(obj.created_at).getTime() > oneHourAgo) {
        return false
      }
      return true
    })
    .map((obj) => ({
      bucket_id: 'lms-notes',
      name: `${access.schoolId}/${obj.name}`,
      bytes: obj.metadata?.size ?? 0,
      created_at: obj.created_at ?? new Date().toISOString(),
    }))

  const orphans = [...baseOrphans, ...notesOrphans]

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <p className="text-xs text-text-secondary mb-1">
          <Link href="/dashboard/lms" className="hover:text-primary">
            Lessons
          </Link>{' '}
          / Storage Management
        </p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">LMS Storage & Media</h1>
            <p className="text-xs text-text-secondary mt-1">
              Monitor storage consumption, identify large video files, and clean up orphaned objects.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            Storage Admin
          </span>
        </div>
      </div>

      {/* Usage Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Lesson Videos */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Lesson Videos
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {formatFileSize(lessonBytes)}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {lessonCount} video {lessonCount === 1 ? 'file' : 'files'} in <code className="text-[11px] font-mono">lms-lessons</code>
            </p>
          </div>
        </div>

        {/* Assignment Files */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Assignment Files
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {formatFileSize(assignmentBytes)}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {assignmentCount} student & activity {assignmentCount === 1 ? 'file' : 'files'}
            </p>
          </div>
        </div>

        {/* Total School LMS Storage */}
        <div className="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3 bg-gradient-to-br from-surface to-surface-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Total Used
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-text-primary">
              {formatFileSize(totalBytes)}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              {totalCount} total media {totalCount === 1 ? 'object' : 'objects'}
            </p>
          </div>
        </div>
      </div>

      {/* Largest Lessons Table */}
      <section className="bg-surface border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Largest Lessons</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Top 15 lessons sorted by video file size.
          </p>
        </div>

        <div className="border border-border rounded-xl overflow-hidden">
          {largestLessons.length === 0 ? (
            <p className="text-center py-8 text-xs text-text-muted">
              No lessons with video uploads found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-muted/40 border-b border-border text-text-secondary">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Lesson</th>
                    <th className="text-left px-4 py-2.5 font-medium">Class</th>
                    <th className="text-left px-4 py-2.5 font-medium">Subject</th>
                    <th className="text-left px-4 py-2.5 font-medium">Size</th>
                    <th className="text-left px-4 py-2.5 font-medium">Codec</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {largestLessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-surface-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        <Link
                          href={`/dashboard/lms/${lesson.id}`}
                          className="hover:text-primary transition-colors hover:underline"
                        >
                          {lesson.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {lesson.className}
                      </td>
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {lesson.subjectName}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-primary whitespace-nowrap">
                        {lesson.sizeBytes !== null ? formatFileSize(lesson.sizeBytes) : 'unknown'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {lesson.codec ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-muted border border-border text-text-secondary">
                            {formatCodecLabel(lesson.codec as VideoCodec)}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">unknown</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Orphaned Files Section */}
      <section className="bg-surface border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Orphaned Files</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Storage objects that are no longer linked to active lessons or assignments.
          </p>
        </div>

        {/* Explanatory note */}
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 text-xs text-blue-900 flex items-start gap-3">
          <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1">
            <p className="font-semibold text-blue-950">About Orphaned Files</p>
            <p className="text-blue-900/90 leading-relaxed">
              Orphaned files are objects in Supabase Storage that are not linked to any active lesson or assignment in your school. Unfinished uploads younger than 1 hour are not listed to ensure active uploads in progress are not accidentally removed.
            </p>
          </div>
        </div>

        <OrphansTable orphans={orphans} />
      </section>
    </div>
  )
}
